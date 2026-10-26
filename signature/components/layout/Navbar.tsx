"use client";

import { useState, Fragment, useRef } from "react";
import Link from "next/link";
import { Dialog, Transition } from "@headlessui/react";
import { Search, X, Menu, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  return (
    <nav className="relative flex items-center justify-between p-4 bg-background border-b border-border sticky top-0 z-40">
      {/* Hamburger Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        aria-label="Open menu"
        aria-expanded={isOpen}
      >
        <Menu className="w-6 h-6" />
      </Button>

      {/* Logo */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl font-bold uppercase tracking-widest text-foreground">
        KOJI
      </div>

      {/* Slide-over Menu */}
      <Transition show={isOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setIsOpen(false)}
          initialFocus={searchInputRef}
        >
          {/* Overlay - Fade in/out */}
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
              <div className="pointer-events-none fixed inset-y-0 left-0 flex max-w-full pr-10">
                {/* Panel - Slide in from left */}
                <Transition.Child
                  as={Fragment}
                  enter="transform transition ease-in-out duration-500 sm:duration-700"
                  enterFrom="-translate-x-full"
                  enterTo="translate-x-0"
                  leave="transform transition ease-in-out duration-500 sm:duration-700"
                  leaveFrom="translate-x-0"
                  leaveTo="-translate-x-full"
                >
                  <Dialog.Panel className="pointer-events-auto w-screen max-w-md relative flex flex-col bg-background shadow-xl h-full border-r border-border">

                    {/* Header: Search + Close */}
                    <div className="flex items-center gap-4 p-4 border-b border-border">
                      {/* Search Input with Icon */}
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          ref={searchInputRef}
                          type="search"
                          placeholder="Rechercher…"
                          className="pl-9 w-full rounded-full bg-muted border-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsOpen(false)}
                        className="rounded-full"
                      >
                        <X className="w-6 h-6" />
                        <span className="sr-only">Close menu</span>
                      </Button>
                    </div>

                    {/* Links */}
                    <div className="flex-1 overflow-y-auto">
                      <ul className="flex flex-col">
                        {["Page d’accueil", "Contact", "Galerie"].map((item) => (
                          <li key={item} className="border-b last:border-b-0 border-border">
                            <Link
                              href="#"
                              className="block px-6 py-5 text-lg font-medium hover:bg-muted transition-colors text-foreground"
                            >
                              {item}
                            </Link>
                          </li>
                        ))}
                      </ul>

                      {/* Contact Section */}
                      <div className="p-6 mt-4 space-y-6">
                        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                          Contactez-nous
                        </h3>
                        <div className="space-y-4">
                          <a href="tel:+33123456789" className="flex items-center gap-3 text-foreground hover:text-primary transition-colors">
                            <div className="p-2 bg-muted rounded-full">
                              <Phone className="w-4 h-4" />
                            </div>
                            <span>01 23 45 67 89</span>
                          </a>
                          <a href="mailto:contact@koji.com" className="flex items-center gap-3 text-foreground hover:text-primary transition-colors">
                            <div className="p-2 bg-muted rounded-full">
                              <Mail className="w-4 h-4" />
                            </div>
                            <span>contact@koji.com</span>
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Bottom CTA */}
                    <div className="p-6 border-t border-border bg-muted/20">
                      <Button className="w-full rounded-full text-lg h-12 shadow-lg" size="lg">
                        Contactez-nous
                      </Button>
                    </div>

                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </div>
        </Dialog>
      </Transition>
    </nav>
  );
}
