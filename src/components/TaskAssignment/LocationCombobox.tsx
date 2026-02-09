import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, MapPin, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { locationService, SavedLocation } from '@/services/locationService';

interface LocationComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const LocationCombobox: React.FC<LocationComboboxProps> = ({
  value,
  onChange,
  placeholder = 'เลือกหรือพิมพ์สถานที่...'
}) => {
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');

  // Load saved locations on mount
  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const data = await locationService.getLocations();
      setLocations(data);
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (locationName: string, locationId?: string) => {
    onChange(locationName);
    setOpen(false);
    setInputValue('');

    // Increment usage if selecting existing location
    if (locationId) {
      try {
        await locationService.incrementUsage(locationId);
        loadLocations(); // Refresh to update order
      } catch (error) {
        console.warn('Failed to increment usage:', error);
      }
    }
  };

  const handleAddNew = async () => {
    if (!inputValue.trim()) return;

    try {
      await locationService.createLocation(inputValue.trim());
      onChange(inputValue.trim());
      setOpen(false);
      setInputValue('');
      loadLocations(); // Refresh list
    } catch (error) {
      console.error('Error creating location:', error);
    }
  };

  const handleDelete = async (e: React.MouseEvent, locationId: string) => {
    e.stopPropagation();
    try {
      await locationService.deleteLocation(locationId);
      loadLocations();
      // Clear value if deleted location was selected
      const deletedLocation = locations.find(l => l.id === locationId);
      if (deletedLocation && deletedLocation.name === value) {
        onChange('');
      }
    } catch (error) {
      console.error('Error deleting location:', error);
    }
  };

  // Check if input value matches any existing location
  const inputMatchesExisting = locations.some(
    loc => loc.name.toLowerCase() === inputValue.toLowerCase()
  );

  // Filter locations based on input
  const filteredLocations = inputValue
    ? locations.filter(loc =>
        loc.name.toLowerCase().includes(inputValue.toLowerCase())
      )
    : locations;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-left font-normal border-pink-200 hover:border-pink-300"
        >
          <div className="flex items-center gap-2 truncate">
            <MapPin className="h-4 w-4 text-pink-500 flex-shrink-0" />
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value || placeholder}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 bg-white" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="ค้นหาหรือพิมพ์สถานที่ใหม่..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                กำลังโหลด...
              </div>
            ) : (
              <>
                {filteredLocations.length === 0 && !inputValue && (
                  <CommandEmpty>ยังไม่มีสถานที่ที่บันทึกไว้</CommandEmpty>
                )}

                {filteredLocations.length > 0 && (
                  <CommandGroup heading="สถานที่ที่บันทึกไว้">
                    {filteredLocations.map((location) => (
                      <CommandItem
                        key={location.id}
                        value={location.name}
                        onSelect={() => handleSelect(location.name, location.id)}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Check
                            className={cn(
                              "h-4 w-4",
                              value === location.name ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span>{location.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                          onClick={(e) => handleDelete(e, location.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {/* Show option to add new location if typing something new */}
                {inputValue && !inputMatchesExisting && (
                  <>
                    {filteredLocations.length > 0 && <CommandSeparator />}
                    <CommandGroup>
                      <CommandItem
                        onSelect={handleAddNew}
                        className="text-pink-600"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        <span>เพิ่ม "{inputValue}" เป็นสถานที่ใหม่</span>
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default LocationCombobox;
