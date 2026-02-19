"use client";

import * as React from "react";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

export default function Input({ className, ...props }: InputProps) {
  return <input {...props} className={cn("uiInput", className)} />;
}
