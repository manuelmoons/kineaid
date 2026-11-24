import { useTranslation } from 'react-i18next';
import { normalizeLang, type Lang } from '../lib/exercises';

/**
 * Who is responsible for KineAid and how to reach them.
 * Fill in before publishing: Google shows a link to this page on its sign-in screen.
 */
export const PRIVACY_CONTACT = {
  name: 'KineAid',
  email: 'kineaid@gmail.com', // shown on this page
};
const LAST_UPDATED: Record<Lang, string> = { nl: '24 november 2026', en: '24 November 2026' };

interface Section {
  title: string;
  body: (string | string[])[];
}

const TEXT: Record<Lang, { title: string; intro: string; sections: Section[]; contactLabel: string; noContact: string; updated: string }> = {
  nl: {
    title: 'Privacybeleid',
    intro:
      'KineAid helpt kinesitherapeuten en hun patiënten met oefenprogramma’s. Hier lees je welke gegevens de app bewaart, waarvoor, wie ze ziet en welke rechten je hebt.',
    sections: [
      {
        title: 'Welke gegevens bewaren we?',
        body: [
          [
            'Je account: e-mailadres, naam, taal en of je kinesitherapeut of patiënt bent. Je wachtwoord wordt versleuteld bewaard; wij kunnen het niet lezen.',
            'Meld je je aan met Google, dan krijgen we van Google alleen je naam en e-mailadres.',
            'Als kinesitherapeut: de naam van je praktijk, je uitnodigingscode en de oefeningen die je zelf maakt, met hun foto’s.',
            'Als patiënt: met welke kinesitherapeut je verbonden bent, je oefenprogramma’s en je oefengeschiedenis (wanneer je oefende, hoeveel sets en of je een oefening afwerkte).',
          ],
        ],
      },
      {
        title: 'Waarvoor gebruiken we ze?',
        body: [
          'Alleen om de app te laten werken: je oefeningen tonen, je voortgang bijhouden en die voortgang tonen aan je eigen kinesitherapeut. We gebruiken je gegevens niet voor reclame, verkopen ze niet en maken er geen profielen mee.',
          'We verwerken je gegevens om de dienst te leveren die jij en je kinesitherapeut gebruiken. Gegevens over je oefeningen gaan over je gezondheid; die verwerken we alleen omdat jij de app gebruikt voor je behandeling. Je kan altijd vragen om ze te wissen.',
        ],
      },
      {
        title: 'Wie ziet je gegevens?',
        body: [
          [
            'Jij ziet je eigen gegevens.',
            'De kinesitherapeut met wie je verbonden bent, ziet je naam, e-mailadres, je programma’s en je voortgang.',
            'Andere gebruikers zien niets van jou.',
            'Foto’s bij oefeningen worden bewaard met een lange, moeilijk te raden link. Wie die link heeft, kan de foto bekijken. Kinesitherapeuten: zet geen herkenbare patiënten op oefenfoto’s.',
          ],
        ],
      },
      {
        title: 'Waar worden ze bewaard?',
        body: [
          [
            'Database, aanmelden en foto’s: Supabase, in een datacenter in de Europese Unie (Ierland).',
            'De website zelf wordt geleverd door Cloudflare. Daarbij worden technische gegevens zoals je IP-adres kort verwerkt om de pagina’s af te leveren en de site te beveiligen.',
            'Google: alleen als je kiest voor aanmelden met Google.',
          ],
        ],
      },
      {
        title: 'Cookies en opslag op je toestel',
        body: [
          'KineAid gebruikt geen advertentie- of analysecookies. De app bewaart op je toestel alleen wat nodig is: dat je aangemeld bent, je taal, je keuze voor de oefenpop en een uitnodigingscode tot je die gebruikt hebt.',
        ],
      },
      {
        title: 'Hoe lang bewaren we ze?',
        body: [
          'Zolang je account bestaat. Vraag je om je account te verwijderen, dan wissen we je account en alle bijhorende programma’s en oefengeschiedenis. Reservekopieën van de database worden na korte tijd vanzelf overschreven.',
        ],
      },
      {
        title: 'Jouw rechten',
        body: [
          'Je mag je gegevens inkijken, laten verbeteren of laten wissen, een kopie vragen en bezwaar maken. Neem daarvoor contact met ons op. Ben je niet tevreden over hoe we met je gegevens omgaan, dan kan je klacht indienen bij de Gegevensbeschermingsautoriteit (www.gegevensbeschermingsautoriteit.be).',
        ],
      },
    ],
    contactLabel: 'Contact',
    noContact: 'Vragen over je gegevens? Neem contact op met je kinesitherapeut.',
    updated: 'Laatst bijgewerkt',
  },
  en: {
    title: 'Privacy policy',
    intro:
      'KineAid helps physiotherapists and their patients with exercise programs. This page explains which data the app stores, why, who can see it and what your rights are.',
    sections: [
      {
        title: 'Which data do we store?',
        body: [
          [
            'Your account: email address, name, language and whether you are a physiotherapist or a patient. Your password is stored encrypted; we cannot read it.',
            'If you sign in with Google, we only receive your name and email address from Google.',
            'As a physiotherapist: the name of your practice, your invite code and the exercises you create, with their photos.',
            'As a patient: which physiotherapist you are connected to, your exercise programs and your exercise history (when you exercised, how many sets and whether you finished an exercise).',
          ],
        ],
      },
      {
        title: 'What do we use it for?',
        body: [
          'Only to make the app work: showing your exercises, keeping track of your progress and showing that progress to your own physiotherapist. We do not use your data for advertising, do not sell it and do not build profiles with it.',
          'We process your data to provide the service you and your physiotherapist use. Data about your exercises concerns your health; we only process it because you use the app for your treatment. You can always ask us to delete it.',
        ],
      },
      {
        title: 'Who can see your data?',
        body: [
          [
            'You can see your own data.',
            'The physiotherapist you are connected to sees your name, email address, your programs and your progress.',
            'Other users see nothing about you.',
            'Exercise photos are stored behind a long, hard-to-guess link. Anyone who has that link can view the photo. Physiotherapists: do not put recognisable patients in exercise photos.',
          ],
        ],
      },
      {
        title: 'Where is it stored?',
        body: [
          [
            'Database, sign-in and photos: Supabase, in a data centre in the European Union (Ireland).',
            'The website itself is delivered by Cloudflare. Technical data such as your IP address is briefly processed to deliver the pages and protect the site.',
            'Google: only if you choose to sign in with Google.',
          ],
        ],
      },
      {
        title: 'Cookies and storage on your device',
        body: [
          'KineAid uses no advertising or analytics cookies. The app only stores what it needs on your device: that you are signed in, your language, your choice of exercise figure and an invite code until you have used it.',
        ],
      },
      {
        title: 'How long do we keep it?',
        body: [
          'As long as your account exists. If you ask us to delete your account, we delete it together with all related programs and exercise history. Database backups are overwritten automatically after a short time.',
        ],
      },
      {
        title: 'Your rights',
        body: [
          'You may view, correct or delete your data, ask for a copy and object. Contact us to do so. If you are not satisfied with how we handle your data, you can file a complaint with the Belgian Data Protection Authority (www.dataprotectionauthority.be).',
        ],
      },
    ],
    contactLabel: 'Contact',
    noContact: 'Questions about your data? Contact your physiotherapist.',
    updated: 'Last updated',
  },
};

export default function Privacy() {
  const { i18n } = useTranslation();
  const lang = normalizeLang(i18n.resolvedLanguage);
  const tx = TEXT[lang];
  return (
    <article className="space-y-4">
      <h1 className="text-2xl font-bold">{tx.title}</h1>
      <p className="text-slate-700">{tx.intro}</p>
      {tx.sections.map((s) => (
        <section key={s.title} className="card space-y-2">
          <h2 className="font-semibold">{s.title}</h2>
          {s.body.map((b, i) =>
            Array.isArray(b) ? (
              <ul key={i} className="list-disc space-y-1 pl-5 text-slate-700">
                {b.map((li) => (
                  <li key={li}>{li}</li>
                ))}
              </ul>
            ) : (
              <p key={i} className="text-slate-700">
                {b}
              </p>
            ),
          )}
        </section>
      ))}
      <section className="card space-y-1">
        <h2 className="font-semibold">{tx.contactLabel}</h2>
        {PRIVACY_CONTACT.email ? (
          <p className="text-slate-700">
            {PRIVACY_CONTACT.name} ·{' '}
            <a href={`mailto:${PRIVACY_CONTACT.email}`} className="text-brand-700 underline">
              {PRIVACY_CONTACT.email}
            </a>
          </p>
        ) : (
          <p className="text-slate-700">{tx.noContact}</p>
        )}
      </section>
      <p className="text-xs text-slate-500">
        {tx.updated}: {LAST_UPDATED[lang]}
      </p>
    </article>
  );
}
