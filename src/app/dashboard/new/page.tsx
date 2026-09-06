import NewConsultationForm from "./NewConsultationForm";

export default function NewConsultationPage() {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">New consultation</h2>
        <p className="text-sm text-gray-500">
          Enter a patient / reference name to create a consultation and a
          shareable call link.
        </p>
      </div>
      <NewConsultationForm />
    </section>
  );
}
