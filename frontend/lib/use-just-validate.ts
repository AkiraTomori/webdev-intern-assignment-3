"use client";

import JustValidate, { Rules } from "just-validate";
import { useEffect, useRef, type RefObject } from "react";
import { isValidSbd } from "./sbd";

type Options = {
  formRef: RefObject<HTMLFormElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  /** An empty element React never gives children: JustValidate puts the error text in it. */
  errorsRef: RefObject<HTMLDivElement | null>;
  /** Translated error text. Changing it (language change) rebuilds the validator. */
  message: string;
  /** Called with the form submission once the SBD passes the format rule. */
  onValid: () => void;
};

/** JustValidate wrapped in a hook. It owns the format check of the SBD field. */
export function useSbdValidation({ formRef, inputRef, errorsRef, message, onValid }: Options) {
  const onValidRef = useRef(onValid);
  useEffect(() => {
    onValidRef.current = onValid;
  });

  useEffect(() => {
    const form = formRef.current;
    const input = inputRef.current;
    const errors = errorsRef.current;
    if (!form || !input || !errors) return;

    const validator = new JustValidate(
      form,
      {
        lockForm: false,
        focusInvalidField: false,
        errorFieldCssClass: "field-invalid",
        errorLabelCssClass: "field-error",
        // Colours come from the theme (globals.css); the library's inline red would fail in dark mode.
        errorFieldStyle: {},
        errorLabelStyle: {},
      },
    );
    validator
      .addField(input, [
        { rule: Rules.Required, errorMessage: message },
        { validator: (value: string | boolean) => typeof value === "string" && isValidSbd(value), errorMessage: message },
      ], { errorsContainer: errors })
      .onValidate(({ isValid }) => {
        if (isValid) input.removeAttribute("aria-invalid");
        else input.setAttribute("aria-invalid", "true");
      })
      .onSuccess(() => onValidRef.current());

    // A language change rebuilds the validator. If an error was showing, show it again in the new language.
    if (input.getAttribute("aria-invalid") === "true") void validator.revalidateField(input);

    return () => {
      validator.destroy();
    };
  }, [formRef, inputRef, errorsRef, message]);
}
