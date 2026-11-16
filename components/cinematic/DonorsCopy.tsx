"use client";
import Link from "next/link";

/** For Donors copy — shared by the cinematic stage and the in-page section. Based on the real donor portal. */
export default function DonorsCopy() {
  return (
    <div className="dc">
      <p className="dc-eyebrow" data-dc>For donors</p>
      <h2 className="dc-title" data-dc>One donor&rsquo;s decision can give someone <em>more time.</em></h2>
      <p className="dc-lede" data-dc>The donor portal shows the volunteer registry with each donor’s availability, so requests can be answered faster. When LifeLine matches a request, it only considers donors who are available and blood-group compatible.</p>
      <div className="dc-cta" data-dc>
        <Link href="/donor" className="dc-btn">Open donor portal <span aria-hidden="true">→</span></Link>
      </div>
    </div>
  );
}
