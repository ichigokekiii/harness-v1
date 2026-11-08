const screens = [
  ["Login", "Centered form, sample accounts, Google chooser"],
  ["Chat home", "248px rail, 720px column, docked composer"],
  ["Chat thread", "Cited answer, yellow source number, page rail"],
  ["Library", "Institution and My folder, upload, share status"],
  ["Space home", "Prompt, recent boards"],
  ["Space canvas", "Agent, library, layers, canvas, inspector, navy tool dock"],
  ["Form", "Scan beside fields and signature"],
  ["Eval", "Ten tasks, timer, CSV"],
  ["Admin queue", "Table with confidence and status"],
  ["OCR review", "Scan beside editable text"],
  ["Documents", "Visibility and supersede"],
  ["People", "Invite and disable"],
  ["Tickets", "Missing document and retirement"],
  ["Activity", "Asked, opened, recent"],
  ["Audit", "Filterable events"],
  ["Super overview", "Queue depth, roles, live audit"],
  ["Institutions", "Sample Academy and North Demo School"],
  ["Health", "Model, OCR, index"],
  ["Settings", "Profile, theme, password"],
];

export default function Wireframes() {
  return (
    <main className="min-h-dvh bg-[#d9d7d1] px-6 py-8 text-[#1a1a18]">
      <h1 className="text-2xl font-semibold">Grey-box map</h1>
      <p className="mt-2 max-w-2xl text-sm">Every role lands on a screen below. The built app uses the Cursor column for Chat and the Figma dock for Space.</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {screens.map(([title, note]) => (
          <section key={title} className="rounded-xl border border-[#bdbab2] bg-[#eceae4] p-3">
            <div className="mb-3 h-8 rounded bg-[#c8c5bd]" />
            <div className="grid grid-cols-[72px_1fr] gap-2">
              <div className="h-28 rounded bg-[#c8c5bd]" />
              <div className="space-y-2">
                <div className="h-6 rounded bg-white" />
                <div className="h-16 rounded bg-white" />
              </div>
            </div>
            <h2 className="mt-3 text-sm font-medium">{title}</h2>
            <p className="text-xs text-[#5c5a52]">{note}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
