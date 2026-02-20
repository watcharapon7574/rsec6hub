import { Badge } from '@/components/ui/badge';

interface Props {
  categories: string[];
  selected?: string;
  onSelect: (category?: string) => void;
}

const NewsfeedCategoryFilter = ({ categories, selected, onSelect }: Props) => (
  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
    <Badge
      variant={!selected ? 'default' : 'outline'}
      className="cursor-pointer whitespace-nowrap shrink-0"
      onClick={() => onSelect(undefined)}
    >
      ทั้งหมด
    </Badge>
    {categories.map(cat => (
      <Badge
        key={cat}
        variant={selected === cat ? 'default' : 'outline'}
        className="cursor-pointer whitespace-nowrap shrink-0"
        onClick={() => onSelect(cat)}
      >
        {cat}
      </Badge>
    ))}
  </div>
);

export default NewsfeedCategoryFilter;
