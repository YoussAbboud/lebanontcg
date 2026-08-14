// Grade badge styled after R3's grading-slab labels: light strip, red bar,
// heavy grade text.
export function SlabBadge({ company, grade }: { company: string | null; grade: string }) {
  // Grades usually arrive as "PSA 9" — avoid repeating the company.
  const gradeText =
    company && grade.toUpperCase().startsWith(company.toUpperCase())
      ? grade.slice(company.length).trim()
      : grade;
  return (
    <span className="slab" title={`Graded ${grade}`}>
      <span className="slab-bar" aria-hidden="true" />
      {company && <span className="slab-company">{company}</span>}
      <span className="slab-grade">{gradeText || grade}</span>
    </span>
  );
}
