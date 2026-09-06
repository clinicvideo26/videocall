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

      {/* UI shell only. Room creation + link generation is wired up in Step 4
          (Daily API). The Create button is disabled until then. */}
      <form className="flex max-w-md flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium text-gray-700">
            Patient / reference name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="e.g. Priya S."
            disabled
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 disabled:bg-gray-50"
          />
        </div>
        <button
          type="submit"
          disabled
          className="w-fit rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Create
        </button>
      </form>

      <p className="text-xs text-gray-400">
        Consultation creation (unique ID → Daily room → shareable link) is
        implemented in Step 4.
      </p>
    </section>
  );
}
