import { ProjectSummary, type ProjectSummaryProps } from './ProjectSummary'

/** Rail projet desktop (lot 2) : persistant à droite. */
export function ProjectRail(props: ProjectSummaryProps) {
  return (
    <div
      data-testid="project-rail"
      className="rounded-lg border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-5"
    >
      <ProjectSummary {...props} />
    </div>
  )
}
