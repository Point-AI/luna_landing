import type { Section } from "../lib/types";
import Logo from "../assets/images/logo.png";

const Navbar = ({ sections }: { sections: Section[] }) => {
  return (
    <nav className="w-full pt-12 z-50">
      <ul className="max-w-7xl flex flex-row justify-between px-10 m-auto items-center">
        <li>
          <img
            src={Logo.src}
            alt="PointAI Logo"
            className="w-24 m-0"
            width={Logo.width}
            height={Logo.height}
          />
        </li>

        <div className="m-auto flex gap-8">
          {sections.map((section, ind) => (
            <li key={ind}>
              <a href={section.href} className="text-sm">
                {section.name}
              </a>
            </li>
          ))}
        </div>

        <li>
          <a
            href="#contact"
            className="font-bold text-black bg-white rounded-full px-3 py-2 text-xs tracking-tight"
          >
            Book a demo
          </a>
        </li>
      </ul>
    </nav>
  );
};

export default Navbar;
