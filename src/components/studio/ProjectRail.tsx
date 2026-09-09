import { ProjectSummary, type ProjectSummaryProps } from './ProjectSummary'

/** Rail projet desktop (lot 2) : persistant à droite. */
export function ProjectRail(props: ProjectSummaryProps) {
  return (
    <div
      data-testid="project-rail"
      className="border-l border-[color:var(--sand-deep)] py-3 pl-6"
    >
      <ProjectSummary {...props} />
    </div>
  )
}
