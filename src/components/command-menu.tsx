import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  ChevronRight,
  Laptop,
  Moon,
  Search,
  Sun,
} from 'lucide-react'
import { useServices } from '@/lib/service-lasso-dashboard/hooks'
import { useSearch } from '@/context/search-provider'
import { useTheme } from '@/context/theme-provider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import { sidebarData } from './layout/data/sidebar-data'

export function CommandMenu() {
  const navigate = useNavigate()
  const { open, setOpen } = useSearch()
  const { setTheme } = useTheme()
  const servicesQuery = useServices()

  const runCommand = React.useCallback(
    (command: () => void) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  const serviceResults = React.useMemo(
    () =>
      (servicesQuery.data ?? [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 25),
    [servicesQuery.data]
  )

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder='Search command or service...' />
      <CommandList>
        <ScrollArea type='hover' className='h-72 pr-1'>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading='Services'>
            {serviceResults.map((service) => (
              <CommandItem
                key={service.id}
                value={`${service.name} ${service.id} ${service.role} ${service.note}`}
                onSelect={() => {
                  runCommand(() =>
                    navigate({
                      to: '/services/$serviceId',
                      params: { serviceId: service.id },
                    })
                  )
                }}
              >
                <Search className='size-4 text-muted-foreground' />
                <div className='flex min-w-0 flex-1 items-center justify-between gap-3'>
                  <div className='min-w-0'>
                    <div className='truncate font-medium'>{service.name}</div>
                    <div className='truncate text-xs text-muted-foreground'>
                      {service.id}
                    </div>
                  </div>
                  <div className='text-xs text-muted-foreground'>Details</div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          {sidebarData.navGroups.map((group) => (
            <React.Fragment key={group.title}>
              <CommandGroup heading={group.title}>
                {group.items.map((navItem) => {
                  if (navItem.items?.length) {
                    return navItem.items.map((subItem, i) => (
                      <CommandItem
                        key={`${subItem.url}-${i}`}
                        value={`${navItem.title} ${subItem.title}`}
                        onSelect={() => {
                          runCommand(() => navigate({ to: subItem.url }))
                        }}
                      >
                        <div className='flex size-4 items-center justify-center'>
                          <ChevronRight className='size-2 text-muted-foreground' />
                        </div>
                        {subItem.icon && <subItem.icon className='size-4' />}
                        {subItem.title}
                      </CommandItem>
                    ))
                  }

                  return (
                    <CommandItem
                      key={navItem.url}
                      value={navItem.title}
                      onSelect={() => {
                        runCommand(() => navigate({ to: navItem.url }))
                      }}
                    >
                      {navItem.icon && <navItem.icon className='size-4' />}
                      {navItem.title}
                      <ArrowRight className='ms-auto size-4 text-muted-foreground' />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
              <CommandSeparator />
            </React.Fragment>
          ))}

          <CommandGroup heading='Theme'>
            <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
              <Sun className='size-4' />
              Light
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
              <Moon className='size-4' />
              Dark
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('system'))}>
              <Laptop className='size-4' />
              System
            </CommandItem>
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}
