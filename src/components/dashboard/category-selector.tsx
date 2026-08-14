"use client";

import { ALL_CATEGORIES, CATEGORY_META, type Category } from "@/lib/categories";

interface CategorySelectorProps {
	selected: string[];
	onChange: (categories: string[]) => void;
}

export function CategorySelector({ selected, onChange }: CategorySelectorProps) {
	const allSelected = selected.length === ALL_CATEGORIES.length;
	const noneSelected = selected.length === 0;

	const toggle = (cat: string) => {
		if (selected.includes(cat)) {
			onChange(selected.filter((c) => c !== cat));
		} else {
			onChange([...selected, cat]);
		}
	};

	const toggleAll = () => {
		if (allSelected) {
			onChange([]);
		} else {
			onChange([...ALL_CATEGORIES]);
		}
	};

	return (
		<div className="space-y-4">
			<button
				type="button"
				onClick={toggleAll}
				className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
			>
				{allSelected ? "Deselect All" : "Select All"}
			</button>

			<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
				{ALL_CATEGORIES.map((cat) => {
					const meta = CATEGORY_META[cat as Category];
					const isSelected = selected.includes(cat);

					return (
						<button
							key={cat}
							type="button"
							onClick={() => toggle(cat)}
							className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
								isSelected
									? `${meta.bgColor} ${meta.color} border-current`
									: "border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
							}`}
						>
							<span
								className={`h-2 w-2 rounded-full transition-all ${
									isSelected ? "bg-current scale-100" : "bg-muted-foreground/30 scale-75"
								}`}
							/>
							{meta.label}
						</button>
					);
				})}
			</div>

			{noneSelected && (
				<p className="text-xs text-muted-foreground">
					No categories selected — you&apos;ll see trends from all categories.
				</p>
			)}
		</div>
	);
}
