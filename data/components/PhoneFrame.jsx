import Image from "next/image";

export function PhoneFrame({ children, dark = false }) {
  return (
    <main className={`phone-page ${dark ? "is-dark" : ""}`}>
      <div className="phone-frame">
        {children}
      </div>
    </main>
  );
}

export function KojiLogo({ light = false }) {
  return (
    <div className="koji-logo">
      <Image src="/icons/LOGO.png" width={54} height={54} alt="Koji" priority />
      <span style={{ color: light ? "white" : "var(--navy)" }}>K O J I</span>
    </div>
  );
}
