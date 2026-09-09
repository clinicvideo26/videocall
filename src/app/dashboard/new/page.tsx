import NewConsultationForm from "./NewConsultationForm";

export default function NewConsultationPage() {
  return (
    <section className="card max-w-2xl p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">
          New consultation
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter a patient / reference name to create a consultation and a
          shareable call link.
        </p>
      </div>
      <NewConsultationForm />
    </section>
  );
}
