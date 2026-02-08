"use client";

import { useEffect, useState } from "react";

export function FormattedDate({ date }: { date: Date | string }) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) return null; // Don't render anything on the server

	return (
		<span>
			{new Date(date).toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
				year: "numeric",
			})}
		</span>
	);
}

