
'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, MinusCircle, Loader2 } from 'lucide-react';

type Source = { id: string; name: string; url: string; };

export const SourcesManager = () => {
	const [sources, setSources] = useState<Source[]>([]);
	const [newSourceUrl, setNewSourceUrl] = useState('');
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchSources = async () => {
		setIsLoading(true);
		try {
			const res = await fetch('/api/sources');
			if (!res.ok) throw new Error('Failed to fetch sources');
			const data = await res.json();
			setSources(data);
		} catch (err: any) {
			setError(err.message);
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
		setError(null);
		try {
			const res = await fetch('/api/sources', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: newSourceUrl, type: 'RSS' }),
			});

			if (!res.ok) {
				const errData = await res.json();
				throw new Error(errData.error || 'Failed to add source');
			}

			setNewSourceUrl('');
			await fetchSources(); // Refresh the list after adding
		} catch (err: any) {
			setError(err.message);
		}
	};

	const handleDeleteSource = async (sourceId: string) => {
		// --- Optimistic UI Update ---
		// 1. Keep a copy of the current sources in case we need to revert.
		const originalSources = [...sources];

		// 2. Immediately remove the source from the UI.
		setSources(sources.filter(source => source.id !== sourceId));

		try {
			// 3. Make the API call in the background.
			const res = await fetch(`/api/sources?id=${sourceId}`, {
				method: 'DELETE',
			});

			// 4. If the API call fails, revert the change and show an error.
			if (!res.ok) {
				setSources(originalSources);
				setError("Failed to delete source. Please try again.");
			}
		} catch (err: any) {
			// Also revert on network errors.
			setSources(originalSources);
			setError(err.message);
		}
	};

	return (
		<div>
			<form onSubmit={handleAddSource} className="flex gap-2 mb-6">
				<Input
					type="url"
					value={newSourceUrl}
					onChange={(e) => setNewSourceUrl(e.target.value)}
					placeholder="[https://example.com/rss.xml](https://example.com/rss.xml)"
				/>
				<Button type="submit" size="icon"><Plus className="h-4 w-4" /></Button>
			</form>

			{error && <p className="text-sm text-destructive mb-4">{error}</p>}

			<div className="space-y-2">
				{isLoading ? (
					<div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
				) : (
					sources.map((source) => (
						<div key={source.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
							<div>
								<p className="font-medium">{source.name}</p>
								<p className="text-xs text-muted-foreground">{source.url}</p>
							</div>
							<Button variant="ghost" size="icon" onClick={() => handleDeleteSource(source.id)}>
								<MinusCircle className="h-5 w-5 text-red-500" />
							</Button>
						</div>
					))
				)}
			</div>
		</div>
	);
};
