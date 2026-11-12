import { useSearchParams } from 'react-router-dom';
import ContactForm from '../components/ContactForm/ContactForm';
import { parseOffer } from '../data/offers';
import { socials } from '../data/socials';
import { usePageMeta } from '../hooks/usePageMeta';

/** The public address from the profiles list. Shown as the other way in, and as the fallback if the form fails. */
const directEmail = socials.find((social) => social.platform === 'Email')?.label;

/** Where every "Work with me" button leads. */
export default function ContactPage() {
  usePageMeta(
    'Work with me',
    'Commission a custom map, a spatial analysis, a data visualization, a data story or remote sensing work.',
  );
  const [params] = useSearchParams();

  return (
    <div className="contact wrap">
      <div className="contact__intro">
        <h1 className="t-display">Work with me</h1>
        <ol className="contact__steps">
          <li>Send a few lines about what you need.</li>
          <li>I reply by email to talk through scope and timing.</li>
        </ol>
        {directEmail && (
          <p className="t-meta">
            Prefer email?{' '}
            <a href={`mailto:${directEmail}`} className="contact__direct focus-ring">
              {directEmail}
            </a>
          </p>
        )}
      </div>

      <ContactForm initialOffer={parseOffer(params.get('offer'))} directEmail={directEmail} />
    </div>
  );
}
