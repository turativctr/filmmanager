"use client";

import { useEffect, useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { formatHoraMinOuVazio, parseHoraMin, PLACEHOLDER_HORA_MIN, TITULO_HORA_MIN } from "@/lib/hora-min";

/** Campo de tempo em H:MM (ver lib/hora-min.ts). O texto é só a forma de digitar: o valor é sempre
 *  em minutos.
 *  - Formulário por FormData: passe `name` — um input escondido com esse nome carrega os minutos,
 *    então o submit continua recebendo número como antes.
 *  - Edição direta: `onCommit` dispara ao sair do campo (ou Enter) com o valor novo, só se mudou.
 *  Texto ilegível volta ao último valor válido; vazio só vale com `vazioPermitido`. */
export function HoraMinInput({
  value,
  defaultValue,
  name,
  onCommit,
  vazioPermitido = false,
  negativo = false,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange" | "type"> & {
  value?: number | null;
  defaultValue?: number | null;
  name?: string;
  onCommit?: (min: number | null) => void;
  vazioPermitido?: boolean;
  negativo?: boolean;
}) {
  const inicial = value !== undefined ? value : (defaultValue ?? null);
  const [minutos, setMinutos] = useState<number | null>(inicial);
  const [texto, setTexto] = useState(formatHoraMinOuVazio(inicial));

  // Valor controlado mudou por fora (resposta do servidor, outra edição): ressincroniza.
  useEffect(() => {
    if (value === undefined) return;
    setMinutos(value);
    setTexto(formatHoraMinOuVazio(value));
  }, [value]);

  function commit() {
    const vazio = texto.trim() === "";
    const lido = vazio ? null : parseHoraMin(texto, { negativo });
    if ((vazio && !vazioPermitido) || (!vazio && lido === null)) {
      setTexto(formatHoraMinOuVazio(minutos));
      return;
    }
    setTexto(formatHoraMinOuVazio(lido));
    if (lido === minutos) return;
    setMinutos(lido);
    onCommit?.(lido);
  }

  return (
    <>
      <Input
        inputMode="text"
        placeholder={PLACEHOLDER_HORA_MIN}
        title={TITULO_HORA_MIN}
        {...props}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={(e) => {
          commit();
          props.onBlur?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !name) e.currentTarget.blur();
          props.onKeyDown?.(e);
        }}
      />
      {/* Lido do texto a cada tecla, não só no blur: Enter submete o formulário sem sair do campo. */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={texto.trim() === "" ? (vazioPermitido ? "" : (minutos ?? "")) : (parseHoraMin(texto, { negativo }) ?? minutos ?? "")}
        />
      )}
    </>
  );
}
