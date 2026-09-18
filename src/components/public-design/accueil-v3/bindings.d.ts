/** Lie un fragment DOM à un scope : `{{ chemin }}` dans le texte et les
 *  attributs, `data-bound-text`, `data-bound-src`, `data-bound-href`,
 *  `data-on<événement>`, et les `<template data-list|data-if>`. */
export function bind(root: Node): (scope: unknown) => void
