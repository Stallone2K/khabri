'use client';
import { signIn } from 'next-auth/react';
import { Button } from '../ui/button';
import { LogIn } from 'lucide-react';
import React from 'react';

export const LoginPage = () => (
	<div className="flex h-screen flex-col items-center justify-center bg-background p-4 text-center">
		<h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
			Khabri
		</h1>
		<p className="mt-4 text-lg text-muted-foreground">
			No Fairytale Stories, Just Real-Time News And Trends
		</p>
		<Button onClick={() => signIn('google')} size="lg" className="mt-8">
			<LogIn className="mr-2 h-5 w-5" /> Sign In With Google
		</Button>
	</div>
);
