'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, MinusCircle, Loader2 } from 'lucide-react';
import { toast } from "sonner"; // ✅ Using Sonner

type Source = { id: string; name: string; url: string; };

export const SourcesManager = () => {
	const [sources, setSources] = useState<Source[]>([]);
	const [newSourceUrl, setNewSourceUrl] = useState('');
	const [isLoading, setIsLoading] = useState(true);
	const [isAdding, setIsAdding] = useState(false);

	// Fetch sources on mount
	const fetchSources = async () => {
		try {
			const res = await fetch('/api/sources');
			if (!res.ok) throw new Error('Failed to fetch sources');
			const data = await res.json();
			setSources(data);
		} catch (err: any) {
			console.error(err);
			toast.error("Could not load sources");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchSources();
	}, []);

	const handleAddSource = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newSourceUrl) return;

		setIsAdding(true);

		try {
			// 1. Basic URL Validation
			let urlObj;
			try {
				urlObj = new URL(newSourceUrl);
			} catch (e) {
				throw new Error("Invalid URL. Please include https://");
			}

			// 2. Auto-generate Name
			const name = urlObj.hostname.replace('www.', '');

			const res = await fetch('/api/sources', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: newSourceUrl, name: name, type: 'RSS' }),
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || 'Failed to add source');
			}

			// 3. Success
			setNewSourceUrl('');
			toast.success(`${name} added successfully!`);
			await fetchSources();

		} catch (err: any) {
			toast.error(err.message || "Failed to add source");
		} finally {
			setIsAdding(false);
		}
	};

	const handleDeleteSource = async (sourceId: string) => {
		// Optimistic Update: Remove from UI immediately
		const originalSources = [...sources];
		setSources(sources.filter(source => source.id !== sourceId));

		try {
			const res = await fetch(`/api/sources`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: sourceId })
			});

			if (!res.ok) {
				throw new Error("Failed to delete");
			}
			toast.success("Source removed");
		} catch (err: any) {
			// Revert UI if API fails
			setSources(originalSources);
			toast.error("Failed to delete source");
		}
	};

	return (
		<div>
			<form onSubmit={handleAddSource} className="flex gap-2 mb-6">
				<Input
					type="url"
					value={newSourceUrl}
					onChange={(e) => setNewSourceUrl(e.target.value)}
					placeholder="https://feeds.feedburner.com/TechCrunch"
					disabled={isAdding}
					className="bg-background"
				/>
				<Button type="submit" size="icon" disabled={isAdding}>
					{isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
				</Button>
			</form>

			<div className="space-y-2">
				{isLoading ? (
					<div className="flex items-center justify-center p-4">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : sources.length === 0 ? (
					<div className="text-center py-8 border-2 border-dashed rounded-lg">
						<p className="text-sm text-muted-foreground">No sources added yet.</p>
						<p className="text-xs text-muted-foreground mt-1">Add an RSS feed URL above to get started.</p>
					</div>
				) : (
					sources.map((source) => (
						<div key={source.id} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/5 transition-colors group">
							<div className="overflow-hidden mr-4">
								<p className="font-medium truncate text-sm">{source.name}</p>
								<p className="text-xs text-muted-foreground truncate" title={source.url}>
									{source.url}
								</p>
							</div>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => handleDeleteSource(source.id)}
								className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
							>
								<MinusCircle className="h-4 w-4" />
							</Button>
						</div>
					))
				)}
			</div>
		</div>
	);
};
