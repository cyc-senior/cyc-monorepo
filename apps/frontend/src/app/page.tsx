import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
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
  stepsContent,
  stepsData,
  testerRoundFeatures,
  testerRoundsContent,
} from "@/config/landing-page-data";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background text-foreground">
      <Navbar variant="default" user={null} />

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
    </div>
  );
}
