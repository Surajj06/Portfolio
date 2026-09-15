import { Inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';

const SITE_URL = 'https://www.aisurajjha.in';
const JSON_LD_ELEMENT_ID = 'seo-route-jsonld';

export interface SeoData {
  title: string;
  description: string;
  /** Path relative to the site root, no leading slash (e.g. '' for home, 'projects/foo' for a project page). */
  path: string;
  jsonLd?: object;
}

/**
 * Every route in this SPA shares one static index.html, so without this the
 * <title>/description/canonical/OG tags from the homepage leak onto every
 * project page (and, in an SPA, keep leaking after client-side navigation
 * since nothing else resets them). Each route component calls update() with
 * its own values instead.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  constructor(
    private readonly title: Title,
    private readonly meta: Meta,
    @Inject(DOCUMENT) private readonly doc: Document
  ) {}

  update(data: SeoData): void {
    const url = data.path ? `${SITE_URL}/${data.path}` : `${SITE_URL}/`;

    this.title.setTitle(data.title);
    this.meta.updateTag({ name: 'description', content: data.description });
    this.meta.updateTag({ property: 'og:title', content: data.title });
    this.meta.updateTag({ property: 'og:description', content: data.description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ name: 'twitter:title', content: data.title });
    this.meta.updateTag({ name: 'twitter:description', content: data.description });

    this.setCanonical(url);
    this.setJsonLd(data.jsonLd);
  }

  private setCanonical(url: string): void {
    let link = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private setJsonLd(jsonLd?: object): void {
    this.doc.getElementById(JSON_LD_ELEMENT_ID)?.remove();
    if (!jsonLd) return;

    const script = this.doc.createElement('script');
    script.type = 'application/ld+json';
    script.id = JSON_LD_ELEMENT_ID;
    script.text = JSON.stringify(jsonLd);
    this.doc.head.appendChild(script);
  }
}
