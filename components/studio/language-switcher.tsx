"use client";
import { Check, ChevronDown, Languages } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import type { Locale } from "./i18n";

const languages = [
  { code: "ja", native: "日本語", translated: "Japanese" },
  { code: "en", native: "English", translated: "英語" },
] as const;

/** Interface preference only. Never changes a production's content language. */
export function LanguageSwitcher({
  locale,
  onChange,
  variant = "sidebar",
}: {
  locale: Locale;
  onChange: (value: Locale) => void;
  variant?: "sidebar" | "settings";
}) {
  const en = locale === "en";
  const current = languages.find((language) => language.code === locale)!;
  const label = en ? "Display language" : "表示言語";
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={`language-trigger language-trigger--${variant}`}
          aria-label={`${label}: ${current.native} / Language`}
        >
          <Languages size={17} aria-hidden="true" />
          <span className="language-trigger-copy">
            <span className="language-trigger-label">{label}</span>
            <span lang={current.code} className="language-current">
              {current.native}
            </span>
          </span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="language-menu"
          side={variant === "sidebar" ? "top" : "bottom"}
          align="start"
          sideOffset={8}
          collisionPadding={16}
          aria-label="表示言語 / Display language"
        >
          <DropdownMenu.Label className="language-menu-heading">
            {label}
            <span>Language</span>
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={locale}
            onValueChange={(value) => {
              if (value === "ja" || value === "en") onChange(value);
            }}
          >
            {languages.map((language) => (
              <DropdownMenu.RadioItem
                className="language-option"
                key={language.code}
                value={language.code}
                textValue={language.native}
              >
                <span className="language-option-copy">
                  <span lang={language.code}>{language.native}</span>
                  <small>{language.translated}</small>
                </span>
                <DropdownMenu.ItemIndicator className="language-check">
                  <Check size={17} aria-hidden="true" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
