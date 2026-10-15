import { MenuIcon } from 'lucide-react';
import { useState } from 'react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { LeftBar } from './left-bar';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="bg-card sticky top-0 z-20 border-b">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
              <MenuIcon />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <LeftBar className="px-2" onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>
        <Logo />
        <div className="flex-1" />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
