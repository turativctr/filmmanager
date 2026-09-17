"use client";

import * as React from "react";

import { Textarea, type TextareaProps } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Textarea que cresce com o conteúdo em vez de ganhar barra de rolagem própria — pra campos que
 *  moram dentro de telas de arrastar (Stripboard): barra aninhada ali perde a posição no meio do
 *  arraste, e a rolagem da página tem que ser a única. Não usa `field-sizing: content` porque o
 *  Safari do iPad (o aparelho de set) ainda não suporta. */
const AutoGrowTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, value, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef]
    );

    const resize = React.useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = "auto";
      // border-box: `height` inclui a borda, `scrollHeight` não — sem somar, a última linha fica
      // cortada pela espessura da borda (e sem barra pra rolar até ela).
      const border = el.offsetHeight - el.clientHeight;
      el.style.height = `${el.scrollHeight + border}px`;
    }, []);

    // Recalcula a cada mudança de valor E quando a largura muda (quebra de linha muda com ela —
    // girar o iPad ou abrir a barra lateral não pode deixar o campo cortado).
    React.useLayoutEffect(resize, [value, resize]);
    React.useEffect(() => {
      const el = innerRef.current;
      if (!el || typeof ResizeObserver === "undefined") return;
      let lastWidth = el.clientWidth;
      const observer = new ResizeObserver(() => {
        if (el.clientWidth !== lastWidth) {
          lastWidth = el.clientWidth;
          resize();
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }, [resize]);

    return (
      <Textarea ref={setRefs} value={value} className={cn("resize-none overflow-hidden", className)} {...props} />
    );
  }
);
AutoGrowTextarea.displayName = "AutoGrowTextarea";

export { AutoGrowTextarea };
