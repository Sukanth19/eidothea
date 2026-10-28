import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="doc prose">
      <h1 className="flicker">What we keep</h1>
      <p className="muted">Plainly, so there are no surprises.</p>

      <h2>If you just read</h2>
      <ul>
        <li>We count visits: the page, the kind of device (phone, tablet or computer), and where the visit came from (another site, or a tag on a shared link like <code>?ref=instagram</code>).</li>
        <li>To tell visitors apart within a day, we keep a scrambled code made from your connection and browser, mixed with a secret that is <b>thrown away every day</b>. We never store your IP address, and we can&apos;t follow you from one day to the next.</li>
        <li>
          While a story is open, your browser checks in every 20 seconds with a random code for that tab, so readers can
          see how many others have it open. It&apos;s kept in memory for under a minute and never written down.
        </li>
        <li>
          Some community stories fill in your local time, weekday or the city your clock is set to. Your own browser does
          that; none of it is sent to us. Your browser also remembers which stories you&apos;ve finished, so a story can
          change on a second read.
        </li>
        <li>No advertising, no third-party trackers, no tracking cookies.</li>
        <li>Visit records are deleted after about a year.</li>
      </ul>

      <h2>If you have an account</h2>
      <ul>
        <li>Your username, a scrambled (hashed) copy of your password, and when you joined and were last active.</li>
        <li>What you read, once your email is confirmed: which stories you open, how far down you get, roughly how long you spend, and whether you finish. It decides what&apos;s trending and what&apos;s picked for you, and nothing else.</li>
        <li>Who you follow and which stories you recommend. Recommendations show on your profile; follower counts are public, but the list of who follows whom isn&apos;t shown.</li>
        <li>Your email address. It&apos;s used to confirm your account, reset your password and tell you about your membership, and it&apos;s never shown to anyone.</li>
        <li>How you became a member (founding spot, invite or waiting list) and, for invites, who invited you. A request to join the waiting list is kept with its note.</li>
        <li>What you write: stories, drafts, comments, ratings and likes.</li>
        <li>Anything you choose to add: your answer to “how did you hear about us?”, and your profile (display name, bio, Instagram).</li>
        <li>Where your first visit came from, as described above. This browser remembers it until you sign up.</li>
      </ul>

      <h2>Who sees it</h2>
      <ul>
        <li>Everyone sees what you publish, plus your profile if you switch it to public.</li>
        <li>The site&apos;s Overseer, and a few people they trust, can see member activity and visit statistics, to understand who reads and how people find the site. Your drafts stay private to you.</li>
        <li>Nothing is sold or shared with anyone else.</li>
      </ul>

      <h2>Removing your data</h2>
      <p>Ask the Overseer to delete your account. Your stories, comments, ratings and profile go with it.</p>
    </article>
  );
}
