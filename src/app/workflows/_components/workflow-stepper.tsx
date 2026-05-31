type WorkflowStepperProps = {
  currentStep: number;
  steps: string[];
};

export function WorkflowStepper({ currentStep, steps }: WorkflowStepperProps) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isComplete = stepNumber < currentStep;

        const classes = isActive
          ? "border-amber-500 bg-amber-100/90 text-amber-900"
          : isComplete
            ? "border-lime-700/25 bg-lime-50 text-lime-900"
            : "border-stone-900/10 bg-stone-50/85 text-stone-700";

        return (
          <li key={label} className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">Step {stepNumber}</p>
            <p className="mt-1 font-semibold">{label}</p>
          </li>
        );
      })}
    </ol>
  );
}