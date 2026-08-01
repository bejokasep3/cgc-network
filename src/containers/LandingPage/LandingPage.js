import React from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { getRoleHomeRouteName } from '../../util/userHelpers';

import { Heading, Page, LayoutSingleColumn, NamedLink, NamedRedirect } from '../../components';

import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './LandingPage.module.css';

// Feature cards mirroring Billo's "always-on creator pipeline" composition,
// reworded for the CGC Network's brand + creator workflow.
const PIPELINE_STEPS = [
  {
    id: 'post-project',
    titleId: 'LandingPage.pipelineStep1Title',
    bodyId: 'LandingPage.pipelineStep1Body',
  },
  {
    id: 'invite-creators',
    titleId: 'LandingPage.pipelineStep2Title',
    bodyId: 'LandingPage.pipelineStep2Body',
  },
  {
    id: 'review-approve',
    titleId: 'LandingPage.pipelineStep3Title',
    bodyId: 'LandingPage.pipelineStep3Body',
  },
  {
    id: 'ship-deliver',
    titleId: 'LandingPage.pipelineStep4Title',
    bodyId: 'LandingPage.pipelineStep4Body',
  },
];

/**
 * The CGC Network's landing page. Fully custom (not managed through Console/PageBuilder):
 * centered hero + pipeline feature cards, styled after a minimalist reference
 * (Dreamflux.ai / Aoxa) with the section composition of Billo's homepage
 * (minus Billo's "trusted by" logo row).
 *
 * @param {Object} props
 * @param {boolean} props.scrollingDisabled - Whether scrolling is disabled
 * @param {boolean} props.isAuthenticated
 * @param {propTypes.currentUser} props.currentUser
 * @returns {JSX.Element}
 */
export const LandingPageComponent = props => {
  const intl = useIntl();
  const config = useConfiguration();
  const { scrollingDisabled, isAuthenticated, currentUser } = props;

  // Logged-in users land on their role's home base instead of the marketing
  // page — this is what they'd see anyway if they went through /login, so a
  // direct visit to "/" shouldn't show it again.
  if (isAuthenticated && currentUser?.id) {
    return <NamedRedirect name={getRoleHomeRouteName(config, currentUser)} />;
  }

  const title = intl.formatMessage(
    { id: 'LandingPage.schemaTitle' },
    { marketplaceName: config.marketplaceName }
  );
  const description = intl.formatMessage({ id: 'LandingPage.schemaDescription' });

  return (
    <Page
      title={title}
      description={description}
      scrollingDisabled={scrollingDisabled}
      schema={{ '@context': 'http://schema.org', '@type': 'WebPage', name: title }}
    >
      <LayoutSingleColumn topbar={<TopbarContainer />} footer={<FooterContainer />}>
        <div className={css.page}>
          <section className={css.hero}>
            <div className={css.heroInner}>
              <Heading as="h1" rootClassName={css.heroHeading}>
                <FormattedMessage id="LandingPage.heroHeadline" />
              </Heading>
              <p className={css.heroSubtitle}>
                <FormattedMessage id="LandingPage.heroSubtitle" />
              </p>
              <div className={css.ctaRow}>
                <NamedLink name="SignupPage" className={css.heroCta}>
                  <FormattedMessage id="LandingPage.heroCta" />
                </NamedLink>
              </div>
              <div className={css.trustRow}>
                <div className={css.avatarStack}>
                  <span className={css.avatar} />
                  <span className={css.avatar} />
                  <span className={css.avatar} />
                </div>
                <span className={css.trustText}>
                  <FormattedMessage id="LandingPage.trustText" />
                </span>
              </div>
            </div>
          </section>

          <section className={css.pipeline}>
            <Heading as="h2" rootClassName={css.pipelineHeading}>
              <FormattedMessage id="LandingPage.pipelineHeading" />
            </Heading>
            <p className={css.pipelineSubtitle}>
              <FormattedMessage id="LandingPage.pipelineSubtitle" />
            </p>

            <ol className={css.pipelineGrid}>
              {PIPELINE_STEPS.map((step, index) => (
                <li key={step.id} className={css.pipelineCard}>
                  <span className={css.pipelineIndex}>{index + 1}</span>
                  <Heading as="h3" rootClassName={css.pipelineCardTitle}>
                    <FormattedMessage id={step.titleId} />
                  </Heading>
                  <p className={css.pipelineCardBody}>
                    <FormattedMessage id={step.bodyId} />
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => {
  return {
    scrollingDisabled: isScrollingDisabled(state),
    isAuthenticated: state.auth?.isAuthenticated,
    currentUser: state.user?.currentUser,
  };
};

const LandingPage = compose(connect(mapStateToProps))(LandingPageComponent);

export default LandingPage;
