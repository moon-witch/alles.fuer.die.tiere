declare global {
	namespace App {
		interface Locals {
			revealAccess?: boolean;
			user?: { id: string; email: string; displayName: string; role: string };
		}
	}
}

export {};
