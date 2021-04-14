/**
 * External dependencies
 */
import { getNewPath } from '@woocommerce/navigation';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import FullContainer from '.~/components/full-container';
import TopBar from '.~/components/stepper/top-bar';
import CreatePaidAdsCampaignForm from './create-paid-ads-campaign-form';

const dashboardURL = getNewPath( {}, '/google/dashboard', {} );

const CreatePaidAdsCampaign = () => {
	return (
		<FullContainer>
			<TopBar
				title={ __(
					'Create your paid campaign',
					'google-listings-and-ads'
				) }
				backHref={ dashboardURL }
			/>
			<CreatePaidAdsCampaignForm />
		</FullContainer>
	);
};

export default CreatePaidAdsCampaign;