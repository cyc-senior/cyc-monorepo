import React, { Suspense } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import {
  HeroSection,
  StepsSection,
  FeatureSection,
  RoleCardsSection,
  CTASection,
  ABTestingPreview,
  TesterRoundsPreview,
} from "@/components/landing";
import { siteConfig } from "@/config/site-config";
import {
  ctaContent,
  heroContent,
  roleCardsContent,
  rolesData,
  stepsContent,
  stepsData,
  testerRoundFeatures,
  testerRoundsContent,
} from "@/config/landing-page-data";
import { MobileDesktopNotice } from "@/components/mobile-desktop-notice";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-[var(--cyc-bg-brand)] sm:bg-background text-foreground">
      <Suspense fallback={<div className="h-16 border-b border-border bg-background" />}>
        <Navbar variant="default" user={null} />
      </Suspense>

      <MobileDesktopNotice>
        <main className="flex-1">
          <HeroSection
            title={heroContent.title}
            description={heroContent.description}
            primaryAction={heroContent.primaryAction}
            sessionCard={heroContent.sessionCard}
            preview={<ABTestingPreview />}
          />

          <StepsSection title={stepsContent.title} steps={stepsData} />

          <FeatureSection
            title={testerRoundsContent.title}
            description={testerRoundsContent.description}
            features={testerRoundFeatures}
            visual={<TesterRoundsPreview />}
          />

          <RoleCardsSection
            title={roleCardsContent.title}
            description={roleCardsContent.description}
            roles={rolesData}
          />

          <CTASection
            title={ctaContent.title}
            description={ctaContent.description}
            buttonLabel={ctaContent.buttonLabel}
            buttonHref={ctaContent.buttonHref}
          />
        </main>

        <Footer copyright={siteConfig.copyright} links={siteConfig.footerLinks} />
      </MobileDesktopNotice>
    </div>
  );
}
