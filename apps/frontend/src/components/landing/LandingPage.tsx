import { PageLayout } from "@/components/layout/PageLayout";
import { HeroSection } from "@/components/sections/HeroSection";
import { StepsSection } from "@/components/sections/StepsSection";
import { FeatureSection } from "@/components/sections/FeatureSection";
import { RoleCardsSection } from "@/components/sections/RoleCardsSection";
import { CTASection } from "@/components/sections/CTASection";
import { ABTestingPreview } from "@/components/previews/ABTestingPreview";
import { TesterRoundsPreview } from "@/components/previews/TesterRoundsPreview";
import { siteConfig } from "@/config/site-config";
import {
  ctaContent,
  heroContent,
  roleCardsContent,
  rolesData,
  stepsData,
  testerRoundFeatures,
  testerRoundsContent,
} from "@/config/landing-page-data";

export function LandingPage() {
  return (
    <PageLayout
      navbarProps={{
        variant: "default",
        user: null,
      }}
      footerProps={{
        copyright: siteConfig.copyright,
        links: siteConfig.footerLinks,
      }}
    >
      <HeroSection
        title={heroContent.title}
        description={heroContent.description}
        primaryAction={heroContent.primaryAction}
        sessionCard={heroContent.sessionCard}
        preview={<ABTestingPreview />}
      />

      <StepsSection steps={stepsData} />

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
    </PageLayout>
  );
}

