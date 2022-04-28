<?php
declare( strict_types=1 );

namespace Automattic\WooCommerce\GoogleListingsAndAds\Tests\Unit\Jobs;

use Automattic\WooCommerce\GoogleListingsAndAds\ActionScheduler\ActionScheduler;
use Automattic\WooCommerce\GoogleListingsAndAds\ActionScheduler\ActionSchedulerInterface;
use Automattic\WooCommerce\GoogleListingsAndAds\Jobs\ActionSchedulerJobMonitor;
use Automattic\WooCommerce\GoogleListingsAndAds\Jobs\UpdateAllProducts;
use Automattic\WooCommerce\GoogleListingsAndAds\MerchantCenter\MerchantCenterService;
use Automattic\WooCommerce\GoogleListingsAndAds\Product\BatchProductHelper;
use Automattic\WooCommerce\GoogleListingsAndAds\Product\FilteredProductList;
use Automattic\WooCommerce\GoogleListingsAndAds\Product\ProductSyncer;
use Automattic\WooCommerce\GoogleListingsAndAds\Product\ProductRepository;
use Automattic\WooCommerce\GoogleListingsAndAds\Product\ProductSyncerException;
use Automattic\WooCommerce\GoogleListingsAndAds\Tests\Framework\UnitTest;
use Automattic\WooCommerce\GoogleListingsAndAds\Tests\Tools\HelperTrait\JobTrait;
use Automattic\WooCommerce\GoogleListingsAndAds\Tests\Tools\HelperTrait\ProductTrait;
use PHPUnit\Framework\MockObject\MockObject;

/**
 * Class UpdateProductsTest
 *
 * @package Automattic\WooCommerce\GoogleListingsAndAds\Tests\Unit\Jobs
 *
 * @property MockObject|ActionScheduler           $action_scheduler
 * @property MockObject|ActionSchedulerJobMonitor $monitor
 * @property MockObject|ProductSyncer             $product_syncer
 * @property MockObject|ProductRepository         $product_repository
 * @property MockObject|BatchProductHelper		  $product_helper
 * @property MockObject|MerchantCenterService     $merchant_center
 * @property UpdateAllProducts                    $job
 */
class UpdateAllProductsTest extends UnitTest {

	use ProductTrait;
	use JobTrait;

	protected const JOB_NAME          = 'update_all_products';
	protected const CREATE_BATCH_HOOK = 'gla/jobs/' . self::JOB_NAME . '/create_batch';
	protected const PROCESS_ITEM_HOOK = 'gla/jobs/' . self::JOB_NAME . '/process_item';

	/**
	 * Runs before each test is executed.
	 */
	public function setUp(): void {
		parent::setUp();

		$this->action_scheduler   = $this->createMock( ActionSchedulerInterface::class );
		$this->monitor            = $this->createMock( ActionSchedulerJobMonitor::class );
		$this->product_syncer     = $this->createMock( ProductSyncer::class );
		$this->product_repository = $this->createMock( ProductRepository::class );
		$this->product_helper     = $this->createMock( BatchProductHelper::class );
		$this->merchant_center    = $this->createMock( MerchantCenterService::class );
		$this->job                = new UpdateAllProducts(
			$this->action_scheduler,
			$this->monitor,
			$this->product_syncer,
			$this->product_repository,
			$this->product_helper,
			$this->merchant_center
		);

		$this->action_scheduler
			->method( 'has_scheduled_action' )
			->willReturn( false );

		$this->merchant_center
			->method( 'is_connected' )
			->willReturn( true );

		$this->job->init();
	}

	public function test_job_name() {
		$this->assertEquals( self::JOB_NAME, $this->job->get_name() );
	}

	public function test_single_batched_job_with_items() {
		$filtered_product_list = new FilteredProductList( $this->generate_simple_product_mocks_set( 4 ), 4 );

		$this->action_scheduler->expects( $this->exactly( 2 ) )
			->method( 'schedule_immediate' )
			->withConsecutive(
				[ self::CREATE_BATCH_HOOK, [ 1 ] ],
				[ self::PROCESS_ITEM_HOOK, [ $filtered_product_list->get_product_ids() ] ]
			);

		$this->product_repository->expects( $this->once() )
			->method( 'find_sync_ready_products' )
			->willReturn( $filtered_product_list );

		$this->job->schedule();

		do_action( self::CREATE_BATCH_HOOK, 1 );
	}

	public function test_single_batched_job_with_no_items() {
		$filtered_product_list = new FilteredProductList( [], 0 );
		$this->action_scheduler->expects( $this->once() )
			->method( 'schedule_immediate' )
			->with( self::CREATE_BATCH_HOOK, [ 1 ] );
		$this->product_repository->expects( $this->once() )
			->method( 'find_sync_ready_products' )
			->willReturn( $filtered_product_list );

		$this->job->schedule();

		do_action( self::CREATE_BATCH_HOOK, 1 );
	}

	public function test_multiple_batches_of_items_and_empty_one() {

		/* adding a filter to make batch smaller for testing */
		add_filter(
			'woocommerce_gla_batched_job_size',
			function ( $batch_count, $job_name ) {
				if ( self::JOB_NAME === $job_name ) {
					return 2;
				}
				return $batch_count;
			}, 10, 2 );

		$batch_a = new FilteredProductList( $this->generate_simple_product_mocks_set( 2 ), 2 );
		$batch_b = new FilteredProductList( $this->generate_simple_product_mocks_set( 2 ), 2 );
		$batch_c = new FilteredProductList( [], 0 );

		$this->action_scheduler->expects( $this->exactly( 5 ) )
			->method( 'schedule_immediate' )
			->withConsecutive(
				[ self::CREATE_BATCH_HOOK, [ 1 ] ],
				[ self::PROCESS_ITEM_HOOK, [ $batch_a->get_product_ids() ] ],
				[ self::CREATE_BATCH_HOOK, [ 2 ] ],
				[ self::PROCESS_ITEM_HOOK, [ $batch_b->get_product_ids() ] ],
				[ self::CREATE_BATCH_HOOK, [ 3 ] ],
			);

		$this->product_repository->expects( $this->exactly( 3 ) )
			->method( 'find_sync_ready_products' )
			->withConsecutive( [ [], 2, 0 ], [ [], 2, 2 ], [ [], 2, 4 ] )
			->willReturnOnConsecutiveCalls( $batch_a, $batch_b, $batch_c );

		$this->job->schedule();

		do_action( self::CREATE_BATCH_HOOK, 1 );
		do_action( self::CREATE_BATCH_HOOK, 2 );
		do_action( self::CREATE_BATCH_HOOK, 3 );
	}

	public function test_process_item() {
		$filtered_product_list = new FilteredProductList( $this->generate_simple_product_mocks_set( 1 ), 1 );

		$this->product_repository
			->expects( $this->once() )
			->method( 'find_by_ids' )
			->with( $filtered_product_list->get_product_ids() )
			->willReturn( $filtered_product_list->get() );

		$this->product_syncer
			->expects( $this->once() )
			->method( 'update' )
			->with( $filtered_product_list->get() );

		do_action( self::PROCESS_ITEM_HOOK, $filtered_product_list->get_product_ids() );
	}

	public function test_reschedule_process_item() {
		$filtered_product_list = new FilteredProductList( $this->generate_simple_product_mocks_set( 1 ), 1 );

		$this->product_repository
			->expects( $this->once() )
			->method( 'find_by_ids' )
			->with( $filtered_product_list->get_product_ids() )
			->willReturn( $filtered_product_list->get() );

		$this->product_syncer
			->expects( $this->once() )
			->method( 'update' )
			->with( $filtered_product_list->get() )
			->will( $this->throwException( new ProductSyncerException() ) );

		$this->action_scheduler
			->expects( $this->once() )
			->method( 'schedule_immediate' )
			->with( self::PROCESS_ITEM_HOOK, [ $filtered_product_list->get_product_ids() ] );

		$this->expectException( ProductSyncerException::class );

		do_action( self::PROCESS_ITEM_HOOK, $filtered_product_list->get_product_ids() );
	}
}