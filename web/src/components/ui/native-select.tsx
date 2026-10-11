import * as React from "react"
import { ChevronDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type NativeSelectProps = React.ComponentProps<"select">

function NativeSelect({ className, ...props }: NativeSelectProps) {
  return (
    <div
      className={cn(
        "group/native-select relative w-fit max-w-full has-[select:disabled]:opacity-50",
        className
      )}
      data-slot="native-select-wrapper"
    >
      <select
        data-slot="native-select"
        className="min-h-[38px] w-full max-w-full min-w-0 cursor-pointer appearance-none rounded-md border border-input bg-card py-[0.45rem] pr-8 pl-[calc(0.7rem+4px)] text-[0.9rem] text-foreground focus-visible:border-primary focus-visible:outline-offset-0 disabled:pointer-events-none disabled:cursor-not-allowed"
        {...props}
      />
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  )
}

function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

export { NativeSelect, NativeSelectOption }
