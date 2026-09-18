import { useEffect, useMemo, useRef, useState } from 'react'
import { CONTINENT_ORDER, TERRITORY_PARENT } from './continents'

interface CountryPickerProps {
  countryNamesByContinent: Map<string, string[]>
  selectedName: string
  onSelect: (name: string) => void
}

// 'all' represents the reset-to-globe-overview option; everything else is an
// actual country name. Keeping this as one flat list (rather than nesting
// groups) is what makes arrow-key navigation and highlighting simple: there's
// one index space regardless of how the list is grouped or filtered.
type NavigableItem = 'all' | string

function labelFor(name: string): string {
  const parent = TERRITORY_PARENT[name]
  return parent ? `${name} (${parent})` : name
}

export default function CountryPicker({ countryNamesByContinent, selectedName, onSelect }: CountryPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  useEffect(() => {
    if (isOpen) searchInputRef.current?.focus()
  }, [isOpen])

  const normalizedQuery = query.trim().toLowerCase()
  const showAllOption = !normalizedQuery || 'all countries'.includes(normalizedQuery)

  const groupsWithMatches = useMemo(() => {
    if (!normalizedQuery) return countryNamesByContinent
    const filtered = new Map<string, string[]>()
    for (const continent of CONTINENT_ORDER) {
      const names = (countryNamesByContinent.get(continent) ?? []).filter((name) =>
        labelFor(name).toLowerCase().includes(normalizedQuery),
      )
      if (names.length > 0) filtered.set(continent, names)
    }
    return filtered
  }, [countryNamesByContinent, normalizedQuery])

  const navigableItems = useMemo<NavigableItem[]>(() => {
    const items: NavigableItem[] = showAllOption ? ['all'] : []
    for (const continent of CONTINENT_ORDER) items.push(...(groupsWithMatches.get(continent) ?? []))
    return items
  }, [groupsWithMatches, showAllOption])

  const selectItem = (item: NavigableItem) => {
    onSelect(item === 'all' ? '' : item)
    setQuery('')
    setIsOpen(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, navigableItems.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const item = navigableItems[highlightedIndex]
      if (item) selectItem(item)
    }
  }

  const triggerLabel = selectedName ? labelFor(selectedName) : 'All countries'

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 1,
        width: 'min(280px, calc(100vw - 32px))',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
      }}
    >
      <button
        type="button"
        onClick={() => {
          setIsOpen((open) => !open)
          setHighlightedIndex(0)
        }}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          background: 'rgba(10, 19, 18, 0.85)',
          color: '#e3ece9',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          cursor: 'pointer',
        }}
      >
        {triggerLabel}
      </button>
      {isOpen && (
        <div
          style={{
            marginTop: 4,
            background: 'rgba(8, 16, 15, 0.97)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 8,
            maxHeight: 'min(70vh, 480px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
          }}
        >
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setHighlightedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search countries..."
            style={{
              padding: '10px 12px',
              border: 'none',
              borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'transparent',
              color: '#e3ece9',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              outline: 'none',
            }}
          />
          <div style={{ overflowY: 'auto' }}>
            {navigableItems.length === 0 ? (
              <div style={{ padding: '12px', color: 'rgba(227, 236, 233, 0.55)' }}>No countries found</div>
            ) : (
              <>
                {showAllOption && (
                  <CountryRow
                    label="All countries"
                    isSelected={selectedName === ''}
                    isHighlighted={navigableItems[highlightedIndex] === 'all'}
                    onClick={() => selectItem('all')}
                  />
                )}
                {CONTINENT_ORDER.map((continent) => {
                  const names = groupsWithMatches.get(continent)
                  if (!names) return null
                  return (
                    <div key={continent}>
                      <div
                        style={{
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          letterSpacing: 0.4,
                          textTransform: 'uppercase',
                          color: 'rgba(227, 236, 233, 0.5)',
                        }}
                      >
                        {continent}
                      </div>
                      {names.map((name) => (
                        <CountryRow
                          key={name}
                          label={labelFor(name)}
                          isSelected={selectedName === name}
                          isHighlighted={navigableItems[highlightedIndex] === name}
                          onClick={() => selectItem(name)}
                        />
                      ))}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CountryRow({
  label,
  isSelected,
  isHighlighted,
  onClick,
}: {
  label: string
  isSelected: boolean
  isHighlighted: boolean
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '8px 12px',
        cursor: 'pointer',
        color: isSelected ? '#f2b134' : '#e3ece9',
        background: isHighlighted ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
      }}
    >
      {label}
    </div>
  )
}
