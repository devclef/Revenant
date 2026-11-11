"use client";

// Feature: 09-demo-polish (P3.1)
//
// The Persona_Intro on the persona page, with the live Stage. The page itself
// is a server component and cannot read the Stage the Ceremony region reports,
// so this client wrapper reads it from PersonaStageContext and passes it to
// PersonaIntro. Before the region has reported, the Stage is treated as
// `emerging`, so the card shows everything, as it does on the server.

import { usePersonaStage } from "../stage-context";

import { PersonaIntro, type PersonaIntroProps } from "./PersonaIntro";

export type PersonaIntroForStageProps = Omit<PersonaIntroProps, "stage">;

export function PersonaIntroForStage(props: PersonaIntroForStageProps) {
  const stage = usePersonaStage() ?? "emerging";
  return <PersonaIntro {...props} stage={stage} />;
}
