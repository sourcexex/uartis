import { Toaster as Sonner } from "sonner"

import { useTheme } from "@/contexts/ThemeContext"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { themeMode } = useTheme()

  return (
    <Sonner
      theme={themeMode as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[var(--app-glass-bg-strong)] group-[.toaster]:text-[var(--app-text-primary)] group-[.toaster]:border-[var(--app-border)] group-[.toaster]:shadow-[var(--app-shadow-2)] group-[.toaster]:backdrop-blur-md",
          description: "group-[.toast]:text-[var(--app-text-secondary)]",
          actionButton:
            "group-[.toast]:bg-[var(--app-accent)] group-[.toast]:text-[var(--app-on-accent)]",
          cancelButton:
            "group-[.toast]:bg-[var(--app-button-secondary-bg)] group-[.toast]:text-[var(--app-text-secondary)]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
