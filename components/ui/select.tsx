"use client"

import * as React from "react"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

const Select = ({ children, value, onValueChange }: any) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, { 
            isOpen, 
            setIsOpen, 
            value, 
            onValueChange 
          })
        }
        return child
      })}
    </div>
  )
}

const SelectTrigger = ({ children, className, isOpen, setIsOpen, value, ...props }: any) => (
  <button
    type="button"
    onClick={() => setIsOpen(!isOpen)}
    className={cn(
      "flex h-12 w-full items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-2 text-sm font-black text-slate-900 shadow-sm transition-all hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
    <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} />
  </button>
)

const SelectValue = ({ placeholder, value, children, ...props }: any) => {
  return <span className="truncate">{value || placeholder}</span>
}

const SelectContent = ({ children, isOpen, setIsOpen, value, onValueChange, className }: any) => {
  if (!isOpen) return null

  return (
    <div
      className={cn(
        "absolute top-full z-50 mt-2 min-w-[8rem] overflow-hidden rounded-2xl border border-slate-100 bg-white p-1 text-slate-950 shadow-2xl shadow-slate-200/50 animate-in fade-in zoom-in-95 duration-200",
        className
      )}
    >
      <div className="max-h-96 w-full overflow-y-auto p-1">
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<any>, { 
              currentValue: value, 
              onValueChange, 
              setIsOpen 
            })
          }
          return child
        })}
      </div>
    </div>
  )
}

const SelectItem = ({ children, value, currentValue, onValueChange, setIsOpen, className }: any) => {
  const isSelected = value === currentValue

  return (
    <div
      onClick={() => {
        onValueChange(value)
        setIsOpen(false)
      }}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-xl py-2 pl-3 pr-9 text-xs font-black uppercase tracking-widest outline-none transition-colors hover:bg-slate-50 focus:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        isSelected ? "text-blue-600 bg-blue-50/50" : "text-slate-500",
        className
      )}
    >
      <span className="flex items-center gap-2">
        {children}
      </span>
      {isSelected && (
        <span className="absolute right-3 flex h-3.5 w-3.5 items-center justify-center">
          <Check className="h-4 w-4" />
        </span>
      )}
    </div>
  )
}

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
}
