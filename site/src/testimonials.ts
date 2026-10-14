// What people say about Taxpresso, quoted as written, in the language it was written in. Only
// with the person's permission (the review form has a box for it, and the name they chose, or
// none), never invented or edited. Until there is one, the card invites the first review.
export interface Testimonial {
  quote: string;
  /** The name the person chose to show; empty for anonymous. */
  name: string;
  /** The language the quote is written in (the lang attribute of the quote). */
  lang: 'fr' | 'en' | 'de' | 'it' | 'es' | 'pt';
}

export const TESTIMONIALS: readonly Testimonial[] = [
  {
    quote:
      'Omg this is the best advance Christmas gift anyone can dream of. Tax admin is such a pain !',
    name: 'Charlotte',
    lang: 'en',
  },
];
