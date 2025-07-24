'use client';

import { useSession, signOut } from 'next-auth/react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { LogOut } from 'lucide-react';

export const UserNav = () => {
	const { data: session } = useSession();
	const user = session?.user;

	return (
		<div className="flex items-center justify-between">
			<div className="flex items-center gap-2">
				<Avatar className="h-8 w-8">
					<AvatarImage src={user?.image ?? ""} alt={user?.name ?? ""} />
					<AvatarFallback>{user?.name?.[0]}</AvatarFallback>
				</Avatar>
				<div className="flex flex-col">
					<span className="text-sm font-medium leading-none">{user?.name}</span>
					<span className="text-xs leading-none text-muted-foreground">{user?.email}</span>
				</div>
			</div>
			<Button variant="ghost" size="icon" onClick={() => signOut()}>
				<LogOut className="h-4 w-4" />
			</Button>
		</div>
	);
};
