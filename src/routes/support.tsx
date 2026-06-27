import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { lookupSoldierByServiceNumber } from "@/lib/soldiers/lookup.functions";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Submit Support Request | UPDF Welfare Portal" },
      {
        name: "description",
        content:
          "Submit a new family welfare support request with documents, urgency level, and notification preferences.",
      },
      { property: "og:title", content: "Submit Support Request | UPDF Welfare Portal" },
      {
        property: "og:description",
        content:
          "Submit a new family welfare support request with documents, urgency level, and notification preferences.",
      },
      { property: "og:url", content: "https://updffamilywelfare.lovable.app/support" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SupportPage,
});

const STEPS = [
  { label: "Request Type", icon: "category" },
  { label: "Beneficiary", icon: "groups" },
  { label: "Profile Details", icon: "badge" },
  { label: "Enter Amount", icon: "payments" },
  { label: "Documents", icon: "upload_file" },
  { label: "Review & Submit", icon: "task_alt" },
];

const MOBILE_MONEY_MAX_UGX = 7_000_000;

const PRIMARY_RELATIONSHIPS = ["Father", "Mother", "Wife", "Husband", "Son", "Daughter"];
const EXTENDED_RELATIONSHIPS = ["Brother", "Sister", "Aunt", "Uncle", "Cousin", "Other"];

function SupportPage() {
  const navigate = useNavigate();
  const { user, profile, isSoldier } = useAuth();
  const [step, setStep] = useState(0);
  const [requestType, setRequestType] = useState("Medical Aid");
  const [urgency, setUrgency] = useState<"Routine" | "Urgent" | "Emergency">("Routine");
  const [notify, setNotify] = useState({ sms: true, email: true, app: true });
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [requestedAmount, setRequestedAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"mobile_money" | "bank_transfer">("mobile_money");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Beneficiary path. Soldiers default to "self"; family users are locked to "family".
  const [beneficiary, setBeneficiary] = useState<"self" | "family">(
    isSoldier ? "self" : "family",
  );

  // Soldier-relationship fields (used when beneficiary === "family").
  const [relationship, setRelationship] = useState<string>("");
  const [soldierFullName, setSoldierFullName] = useState<string>("");
  const [soldierServiceNumber, setSoldierServiceNumber] = useState<string>("");
  const [soldierRank, setSoldierRank] = useState<string>("");
  const [soldierBranch, setSoldierBranch] = useState<string>("");
  const [contactInfo, setContactInfo] = useState<string>("");

  // Family-member (beneficiary) details (used when beneficiary === "family").
  const [familyFullName, setFamilyFullName] = useState<string>("");
  const [familyPhone, setFamilyPhone] = useState<string>("");
  const [familyEmail, setFamilyEmail] = useState<string>("");
  const [familyNin, setFamilyNin] = useState<string>("");

  // Auto-fetch soldier profile when service number is entered.
  const lookupSoldier = useServerFn(lookupSoldierByServiceNumber);
  const [soldierLookupStatus, setSoldierLookupStatus] = useState<
    "idle" | "loading" | "found" | "not_found" | "error"
  >("idle");
  useEffect(() => {
    if (beneficiary !== "family") return;
    const sn = soldierServiceNumber.trim();
    if (sn.length < 4) {
      setSoldierLookupStatus("idle");
      return;
    }
    let cancelled = false;
    setSoldierLookupStatus("loading");
    const t = setTimeout(async () => {
      try {
        const res = await lookupSoldier({ data: { serviceNumber: sn } });
        if (cancelled) return;
        if (res.found) {
          setSoldierFullName(res.fullName);
          setSoldierRank(res.rank);
          setSoldierBranch(res.service);
          setSoldierLookupStatus("found");
        } else {
          setSoldierLookupStatus("not_found");
        }
      } catch {
        if (!cancelled) setSoldierLookupStatus("error");
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [soldierServiceNumber, beneficiary, lookupSoldier]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => f.size <= 10 * 1024 * 1024);
    setFiles((prev) => [...prev, ...incoming]);
  }

  // Whitelist of allowed file types with magic-byte signatures.
  // We never trust the browser-provided `file.type` — it can be spoofed.
  const ALLOWED_TYPES: { mime: string; ext: string; check: (b: Uint8Array) => boolean }[] = [
    {
      mime: "application/pdf",
      ext: "pdf",
      check: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46, // %PDF
    },
    {
      mime: "image/jpeg",
      ext: "jpg",
      check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    },
    {
      mime: "image/png",
      ext: "png",
      check: (b) =>
        b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
        b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
    },
  ];

  async function detectMime(file: File): Promise<string | null> {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    for (const t of ALLOWED_TYPES) {
      if (t.check(head)) return t.mime;
    }
    return null;
  }

  async function submit() {
    if (!user) return;
    const amt = requestedAmount ? Number(requestedAmount) : null;
    if (amt !== null && (!Number.isFinite(amt) || amt < 0)) {
      setError("Enter a valid requested amount in UGX.");
      return;
    }
    if (paymentMethod === "mobile_money" && amt !== null && amt > MOBILE_MONEY_MAX_UGX) {
      setError("Maximum request amount for Mobile Money transfers is 7,000,000 UGX.");
      return;
    }
    if (beneficiary === "family") {
      if (!relationship || !soldierFullName.trim() || !soldierServiceNumber.trim()) {
        setError("Provide your relationship and the soldier's full name and service number.");
        return;
      }
      if (!familyFullName.trim()) {
        setError("Provide the family member's full name.");
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    const beneficiaryHeader =
      beneficiary === "self"
        ? "[Beneficiary: Self]"
        : `[Beneficiary: Family — ${familyFullName} (${relationship} of ${soldierFullName}, ${soldierServiceNumber}${
            soldierRank ? `, ${soldierRank}` : ""
          }${soldierBranch ? `, ${soldierBranch}` : ""})` +
          `${familyPhone ? ` | Phone: ${familyPhone}` : ""}` +
          `${familyEmail ? ` | Email: ${familyEmail}` : ""}` +
          `${familyNin ? ` | NIN: ${familyNin}` : ""}` +
          `]`;
    const composedDetails = [beneficiaryHeader, details.trim()].filter(Boolean).join("\n\n");
    const { data: inserted, error: insertErr } = await supabase
      .from("support_requests")
      .insert({
      user_id: user.id,
      request_type: requestType,
      urgency: urgency.toLowerCase(),
      title: title.trim() || `${requestType} request`,
      details: composedDetails || null,
      status: "pending",
      requested_amount: amt,
      payment_method: paymentMethod,
      })
      .select("id")
      .single();
    if (insertErr || !inserted) {
      setSubmitting(false);
      setError(insertErr?.message ?? "Could not submit request.");
      return;
    }

    for (const file of files) {
      // Validate by magic bytes — do not trust browser-reported file.type,
      // which can be spoofed to image/svg+xml or text/html and execute scripts
      // when officers open the signed URL.
      const verifiedMime = await detectMime(file);
      if (!verifiedMime) {
        setSubmitting(false);
        setError(
          `${file.name} is not a supported file. Only PDF, JPG, or PNG documents are accepted.`,
        );
        return;
      }
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${inserted.id}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("support-documents")
        .upload(path, file, { contentType: verifiedMime, upsert: false });
      if (upErr) {
        setSubmitting(false);
        setError(`Upload failed for ${file.name}: ${upErr.message}`);
        return;
      }
      const { error: docErr } = await supabase.from("request_documents").insert({
        request_id: inserted.id,
        user_id: user.id,
        file_path: path,
        file_name: file.name,
        mime_type: verifiedMime,
        size_bytes: file.size,
      });
      if (docErr) {
        setSubmitting(false);
        setError(`Document record failed: ${docErr.message}`);
        return;
      }
    }

    setSubmitting(false);
    navigate({ to: "/dashboard" });
  }

  function next() {
    if (step === 3 && amountError) return;
    if (step < STEPS.length - 1) setStep(step + 1);
    else void submit();
  }

  return (
    <AppShell
      title="New Support Request"
      subtitle="Provide complete and accurate information. All requests are verified by your assigned welfare officer."
    >
      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-12 lg:col-span-3">
          <ol className="bg-card border border-outline-variant rounded-lg p-4 space-y-1">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li key={s.label}>
                  <button
                    onClick={() => setStep(i)}
                    className={
                      "w-full flex items-center gap-3 p-3 rounded-md text-sm text-left transition-colors " +
                      (active
                        ? "bg-primary-fixed-dim text-primary font-semibold"
                        : done
                          ? "text-on-surface hover:bg-surface-container"
                          : "text-on-surface-variant hover:bg-surface-container")
                    }
                  >
                    <div
                      className={
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold " +
                        (done
                          ? "bg-primary text-on-primary"
                          : active
                            ? "bg-primary text-on-primary"
                            : "bg-surface-container text-on-surface-variant")
                      }
                    >
                      {done ? <Icon name="check" className="text-[16px]" /> : i + 1}
                    </div>
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="mt-4 p-4 rounded-lg bg-primary-fixed-dim/40 border border-primary-fixed-dim text-xs text-primary">
            <p className="font-semibold mb-1 flex items-center gap-1.5">
              <Icon name="shield" className="text-[16px]" />
              Confidential Submission
            </p>
            Your information is encrypted end-to-end and only accessible to your
            assigned welfare officer.
          </div>
        </aside>

        <section className="col-span-12 lg:col-span-9 bg-card border border-outline-variant rounded-lg p-6 md:p-8">
          {step === 0 && (
            <>
              <h2 className="text-xl font-semibold text-primary mb-1">Request Type</h2>
              <p className="text-sm text-on-surface-variant mb-6">
                Choose the category of welfare support you require.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                {REQUEST_TYPES.map((t) => {
                  const active = requestType === t.label;
                  return (
                    <button
                      key={t.label}
                      onClick={() => setRequestType(t.label)}
                      className={
                        "flex items-start gap-4 p-4 rounded-md border-2 text-left transition-colors " +
                        (active
                          ? "border-primary bg-primary-fixed-dim/40"
                          : "border-outline-variant hover:border-primary/40")
                      }
                    >
                      <div className="w-10 h-10 rounded-md bg-primary text-on-primary flex items-center justify-center shrink-0">
                        <Icon name={t.icon} className="text-[20px]" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{t.label}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          {t.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <h3 className="text-sm font-medium text-on-surface mb-3">
                Urgency Level
              </h3>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {(["Routine", "Urgent", "Emergency"] as const).map((u) => {
                  const active = urgency === u;
                  return (
                    <button
                      key={u}
                      onClick={() => setUrgency(u)}
                      className={
                        "py-2.5 rounded-md text-sm font-medium border-2 transition-colors " +
                        (active
                          ? u === "Emergency"
                            ? "border-error bg-red-50 text-error"
                            : u === "Urgent"
                              ? "border-secondary bg-secondary-container text-secondary"
                              : "border-primary bg-primary-fixed-dim text-primary"
                          : "border-outline-variant text-on-surface-variant hover:border-primary/40")
                      }
                    >
                      {u}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="text-xl font-semibold text-primary mb-1">Who is this aid for?</h2>
              <p className="text-sm text-on-surface-variant mb-6">
                Choose whether you are requesting aid for yourself or on behalf of a registered family member.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(
                  [
                    {
                      key: "self" as const,
                      title: "Request Aid for Myself",
                      desc: "For the soldier directly.",
                      icon: "military_tech",
                      disabled: !isSoldier,
                    },
                    {
                      key: "family" as const,
                      title: "Request Aid for a Family Member",
                      desc: "For a registered dependent.",
                      icon: "family_restroom",
                      disabled: false,
                    },
                  ]
                ).map((opt) => {
                  const active = beneficiary === opt.key;
                  return (
                    <button
                      key={opt.key}
                      disabled={opt.disabled}
                      onClick={() => setBeneficiary(opt.key)}
                      className={
                        "flex items-start gap-4 p-4 rounded-md border-2 text-left transition-colors " +
                        (active
                          ? "border-primary bg-primary-fixed-dim/40"
                          : "border-outline-variant hover:border-primary/40") +
                        (opt.disabled ? " opacity-40 cursor-not-allowed" : "")
                      }
                    >
                      <div className="w-10 h-10 rounded-md bg-primary text-on-primary flex items-center justify-center shrink-0">
                        <Icon name={opt.icon} className="text-[20px]" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{opt.title}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">{opt.desc}</p>
                        {opt.disabled && (
                          <p className="text-[11px] text-on-surface-variant mt-1 italic">
                            Only soldier accounts may request aid for themselves.
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-xl font-semibold text-primary mb-1">
                {beneficiary === "self" ? "Soldier Profile" : "My Profile & Soldier Relationship"}
              </h2>
              <p className="text-sm text-on-surface-variant mb-6">
                {beneficiary === "self"
                  ? "Confirm your service details."
                  : "Confirm your details and the soldier you are related to."}
              </p>

              {beneficiary === "self" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ReadOnly label="Full Name" value={profile?.full_name || "—"} />
                  <ReadOnly label="Service Number" value={profile?.service_number || "—"} />
                  <ReadOnly label="Rank" value={profile?.rank || "—"} />
                  <ReadOnly label="Service / Branch" value={profile?.service || "—"} />
                </div>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-on-surface mb-3">Family Member Details</h3>
                  <p className="text-xs text-on-surface-variant mb-3">
                    Provide the details of the family member who will receive the aid.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-xs font-medium text-on-surface-variant mb-1.5 uppercase tracking-wider">
                        Full Name of Family Member
                      </label>
                      <input
                        value={familyFullName}
                        onChange={(e) => setFamilyFullName(e.target.value)}
                        placeholder="e.g. Jane Doe"
                        className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-on-surface-variant mb-1.5 uppercase tracking-wider">
                        Phone
                      </label>
                      <input
                        value={familyPhone}
                        onChange={(e) => setFamilyPhone(e.target.value)}
                        placeholder="e.g. +256 700 000 000"
                        className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-on-surface-variant mb-1.5 uppercase tracking-wider">
                        Email
                      </label>
                      <input
                        type="email"
                        value={familyEmail}
                        onChange={(e) => setFamilyEmail(e.target.value)}
                        placeholder="optional"
                        className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-on-surface-variant mb-1.5 uppercase tracking-wider">
                        National ID (NIN) — Optional
                      </label>
                      <input
                        value={familyNin}
                        onChange={(e) => setFamilyNin(e.target.value.toUpperCase())}
                        placeholder="e.g. CM12345678ABCD"
                        className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-on-surface mb-3">My Profile</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <ReadOnly label="Full Name" value={profile?.full_name || "—"} />
                    <ReadOnly label="Email" value={user?.email || "—"} />
                    <div>
                      <label className="block text-xs font-medium text-on-surface-variant mb-1.5 uppercase tracking-wider">
                        Contact Information
                      </label>
                      <input
                        value={contactInfo}
                        onChange={(e) => setContactInfo(e.target.value)}
                        placeholder="Phone or alternate contact"
                        className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                    <ReadOnly label="National ID (NIN)" value={profile?.nin || "—"} />
                  </div>

                  <h3 className="text-sm font-semibold text-on-surface mb-3">Soldier Relationship Details</h3>
                  <p className="text-xs text-on-surface-variant mb-3">
                    Enter the soldier's service number — name, rank, and branch will be auto-fetched.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-on-surface-variant mb-1.5 uppercase tracking-wider">
                        Relationship to Soldier
                      </label>
                      <select
                        value={relationship}
                        onChange={(e) => setRelationship(e.target.value)}
                        className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm focus:outline-none focus:border-primary"
                      >
                        <option value="">Select relationship…</option>
                        <optgroup label="Primary">
                          {PRIMARY_RELATIONSHIPS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Extended / Adopted">
                          {EXTENDED_RELATIONSHIPS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-on-surface-variant mb-1.5 uppercase tracking-wider">
                        Soldier's Service Number
                      </label>
                      <input
                        value={soldierServiceNumber}
                        onChange={(e) => setSoldierServiceNumber(e.target.value.toUpperCase())}
                        placeholder="e.g. RA/123456"
                        className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm focus:outline-none focus:border-primary"
                      />
                      <p className="mt-1 text-[11px] text-on-surface-variant">
                        {soldierLookupStatus === "loading" && "Looking up soldier…"}
                        {soldierLookupStatus === "found" && (
                          <span className="text-primary">✓ Soldier found and details auto-filled.</span>
                        )}
                        {soldierLookupStatus === "not_found" && (
                          <span className="text-error">No soldier matches this service number.</span>
                        )}
                        {soldierLookupStatus === "error" && (
                          <span className="text-error">Lookup failed — try again.</span>
                        )}
                      </p>
                    </div>
                    <ReadOnly label="Soldier's Full Name (auto)" value={soldierFullName || "—"} />
                    <ReadOnly label="Soldier's Rank (auto)" value={soldierRank || "—"} />
                    <div className="md:col-span-2">
                      <ReadOnly label="Soldier's Service / Branch (auto)" value={soldierBranch || "—"} />
                    </div>
                  </div>
                </>
              )}

              <div className="mt-6">
                <label className="block text-sm font-medium text-on-surface mb-1.5">
                  Request Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`${requestType} — short summary`}
                  className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-md text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-on-surface mb-1.5">
                  Additional Context
                </label>
                <textarea
                  rows={5}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Briefly describe the situation and why support is needed…"
                  className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-md text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-xl font-semibold text-primary mb-1">Financial Aid Request</h2>
              <p className="text-sm text-on-surface-variant mb-6">
                Specify the amount you are requesting and how it should be paid out.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1.5">
                    Requested Amount (UGX)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1000}
                    value={requestedAmount}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRequestedAmount(v);
                      const n = v === "" ? null : Number(v);
                      if (n !== null && paymentMethod === "mobile_money" && n > MOBILE_MONEY_MAX_UGX) {
                        setAmountError("Maximum request amount for Mobile Money transfers is 7,000,000 UGX.");
                      } else {
                        setAmountError(null);
                      }
                    }}
                    placeholder="e.g. 500000"
                    aria-invalid={!!amountError}
                    className={
                      "w-full px-4 py-3 bg-surface-container-low border rounded-md focus:outline-none text-sm " +
                      (amountError ? "border-error focus:border-error" : "border-outline-variant focus:border-primary")
                    }
                  />
                  {amountError ? (
                    <p className="mt-1.5 text-xs text-error">{amountError}</p>
                  ) : (
                    requestedAmount && (
                      <p className="mt-1.5 text-xs text-on-surface-variant">
                        {Number(requestedAmount).toLocaleString("en-UG")} UGX
                      </p>
                    )
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1.5">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => {
                      const v = e.target.value as "mobile_money" | "bank_transfer";
                      setPaymentMethod(v);
                      const n = requestedAmount ? Number(requestedAmount) : null;
                      if (v === "mobile_money" && n !== null && n > MOBILE_MONEY_MAX_UGX) {
                        setAmountError("Maximum request amount for Mobile Money transfers is 7,000,000 UGX.");
                      } else {
                        setAmountError(null);
                      }
                    }}
                    className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-md focus:outline-none focus:border-primary text-sm"
                  >
                    <option value="mobile_money">Mobile Money</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                  <p className="mt-1.5 text-xs text-on-surface-variant">
                    Mobile Money payouts are limited to 7,000,000 UGX per request.
                  </p>
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-xl font-semibold text-primary mb-1">
                Supporting Documents
              </h2>
              <p className="text-sm text-on-surface-variant mb-6">
                Upload required documentation. PDF, JPG, PNG · max 10MB each.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <div
                className="border-2 border-dashed border-outline-variant rounded-lg p-10 text-center bg-surface-container-low cursor-pointer hover:border-primary/40"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(e.dataTransfer.files);
                }}
              >
                <Icon name="cloud_upload" className="text-5xl text-outline" />
                <p className="text-sm font-medium mt-3">
                  Drag and drop files here, or
                  <span className="text-primary underline ml-1">browse</span>
                </p>
                <p className="text-xs text-on-surface-variant mt-1">
                  e.g. Medical certificate, school invoice, hospital bill.
                </p>
              </div>
              <div className="mt-5 space-y-2">
                {files.length === 0 && (
                  <p className="text-xs text-on-surface-variant text-center py-2">
                    No files attached yet.
                  </p>
                )}
                {files.map((f, idx) => (
                  <div
                    key={`${f.name}-${idx}`}
                    className="flex items-center justify-between p-3 border border-outline-variant rounded-md text-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon name="description" className="text-primary text-[20px]" />
                      <span className="truncate">{f.name}</span>
                      <span className="text-xs text-on-surface-variant shrink-0">
                        {(f.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                    <button
                      className="text-error"
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Icon name="delete" className="text-[18px]" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <h2 className="text-xl font-semibold text-primary mb-1">
                Review & Submit
              </h2>
              <p className="text-sm text-on-surface-variant mb-6">
                Confirm your submission and set notification preferences.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <Summary label="Type" value={requestType} />
                <Summary label="Urgency" value={urgency} />
                <Summary
                  label="Beneficiary"
                  value={beneficiary === "self" ? "Self (Soldier)" : `Family — ${relationship || "—"}`}
                />
                {beneficiary === "family" && (
                  <Summary
                    label="Soldier"
                    value={
                      soldierFullName
                        ? `${soldierFullName}${soldierServiceNumber ? ` (${soldierServiceNumber})` : ""}`
                        : "—"
                    }
                  />
                )}
                <Summary label="Title" value={title || `${requestType} request`} />
                <Summary
                  label="Requested Amount"
                  value={requestedAmount ? `${Number(requestedAmount).toLocaleString("en-UG")} UGX` : "—"}
                />
                <Summary
                  label="Payment Method"
                  value={paymentMethod === "mobile_money" ? "Mobile Money" : "Bank Transfer"}
                />
              </div>
              <h3 className="text-sm font-medium mb-3">Notification Preferences</h3>
              <div className="space-y-2 mb-4">
                {(
                  [
                    { key: "sms" as const, label: "SMS to registered mobile", icon: "sms" },
                    { key: "email" as const, label: "Institutional email", icon: "mail" },
                    { key: "app" as const, label: "In-app notifications", icon: "notifications" },
                  ]
                ).map((n) => (
                  <label
                    key={n.key}
                    className="flex items-center justify-between p-3 border border-outline-variant rounded-md cursor-pointer"
                  >
                    <span className="flex items-center gap-3 text-sm">
                      <Icon name={n.icon} className="text-primary text-[20px]" />
                      {n.label}
                    </span>
                    <input
                      type="checkbox"
                      checked={notify[n.key]}
                      onChange={(e) => setNotify((s) => ({ ...s, [n.key]: e.target.checked }))}
                      className="w-5 h-5 accent-[color:var(--primary)]"
                    />
                  </label>
                ))}
              </div>
              {error && (
                <div className="mb-4 text-sm text-error bg-error-container/40 border border-error/30 rounded-md px-3 py-2">
                  {error}
                </div>
              )}
            </>
          )}

          <div className="mt-8 flex justify-between border-t border-outline-variant pt-5">
            <button
              disabled={step === 0}
              onClick={() => setStep(Math.max(0, step - 1))}
              className="px-4 py-2.5 text-sm font-medium border border-outline-variant rounded-md hover:bg-surface-container disabled:opacity-40"
            >
              Back
            </button>
            <button
              onClick={next}
              disabled={submitting}
              className="px-5 py-2.5 text-sm font-semibold bg-primary text-on-primary rounded-md hover:bg-primary-container flex items-center gap-2"
            >
              {submitting ? "Submitting…" : step === STEPS.length - 1 ? "Submit Request" : "Continue"}
              <Icon name="arrow_forward" className="text-[18px]" />
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-on-surface-variant mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      <div className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm text-on-surface">
        {value}
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-surface-container-low rounded-md">
      <p className="text-[10px] uppercase tracking-wider text-outline font-medium">
        {label}
      </p>
      <p className="text-sm font-semibold text-on-surface mt-1">{value}</p>
    </div>
  );
}

const REQUEST_TYPES = [
  { label: "Medical Aid", desc: "Hospital bills, prescriptions, treatment", icon: "medical_services" },
  { label: "Education Bursary", desc: "School fees, scholastic materials", icon: "school" },
  { label: "Financial Support", desc: "Emergency cash assistance", icon: "payments" },
  { label: "Food Assistance", desc: "Household food packages", icon: "restaurant" },
];