import * as React from 'react'
import { CheckIcon, Cross2Icon, PlusCircledIcon } from '@radix-ui/react-icons'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'

type ToolbarFilterOption = {
  label: string
  value: string
  icon?: React.ComponentType<{ className?: string }>
}

type ToolbarFilter = {
  title: string
  selectedValues: string[]
  options: ToolbarFilterOption[]
  onChange: (values: string[]) => void
}

type LocalTableToolbarProps = {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  filters?: ToolbarFilter[]
  onReset?: () => void
}

function LocalFacetedFilter({
  title,
  selectedValues,
  options,
  onChange,
}: ToolbarFilter) {
  const selectedSet = new Set(selectedValues)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='outline' size='sm' className='h-8 border-dashed'>
          <PlusCircledIcon className='size-4' />
          {title}
          {selectedSet.size > 0 && (
            <>
              <Separator orientation='vertical' className='mx-2 h-4' />
              <Badge
                variant='secondary'
                className='rounded-sm px-1 font-normal lg:hidden'
              >
                {selectedSet.size}
              </Badge>
              <div className='hidden space-x-1 lg:flex'>
                {selectedSet.size > 2 ? (
                  <Badge
                    variant='secondary'
                    className='rounded-sm px-1 font-normal'
                  >
                    {selectedSet.size} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedSet.has(option.value))
                    .map((option) => (
                      <Badge
                        variant='secondary'
                        key={option.value}
                        className='rounded-sm px-1 font-normal'
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[220px] p-0' align='start'>
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedSet.has(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      const next = new Set(selectedSet)
                      if (isSelected) {
                        next.delete(option.value)
                      } else {
                        next.add(option.value)
                      }
                      onChange(Array.from(next))
                    }}
                  >
                    <div
                      className={cn(
                        'flex size-4 items-center justify-center rounded-sm border border-primary',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible'
                      )}
                    >
                      <CheckIcon className={cn('h-4 w-4 text-background')} />
                    </div>
                    {option.icon && (
                      <option.icon className='size-4 text-muted-foreground' />
                    )}
                    <span>{option.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {selectedSet.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onChange([])}
                    className='justify-center text-center'
                  >
                    Clear filters
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function LocalTableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Filter...',
  filters = [],
  onReset,
}: LocalTableToolbarProps) {
  const isFiltered =
    searchValue.trim().length > 0 || filters.some((filter) => filter.selectedValues.length > 0)

  return (
    <div className='flex items-center justify-between'>
      <div className='flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2'>
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          className='h-8 w-[150px] lg:w-[250px]'
        />
        <div className='flex flex-wrap gap-2'>
          {filters.map((filter) => (
            <LocalFacetedFilter key={filter.title} {...filter} />
          ))}
        </div>
        {isFiltered && onReset ? (
          <Button variant='ghost' onClick={onReset} className='h-8 px-2 lg:px-3'>
            Reset
            <Cross2Icon className='ms-2 h-4 w-4' />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
