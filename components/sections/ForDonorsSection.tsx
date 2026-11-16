"use client";
import DonorsArt from "@/components/cinematic/DonorsArt";
import DonorsCopy from "@/components/cinematic/DonorsCopy";

/** In-page "For Donors" — the settled end-state of the stage-2 animation (hourglass behind, handshake in front). */
export default function ForDonorsSection() {
  return (
    <section id="for-donors" className="fullbleed sec-dark sec-donors" aria-label="For donors">
      <div className="cine-stage cine-stage-page">
        <div className="cine-grid">
          <div className="cine-textcol"><div className="cine-t2"><DonorsCopy /></div></div>
          <div className="cine-artcol"><DonorsArt settled /></div>
        </div>
      </div>
    </section>
  );
}
