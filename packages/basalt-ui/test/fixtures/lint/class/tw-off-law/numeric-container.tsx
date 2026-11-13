// expect: @max-md:flex
// expect: @lg:grid
// expect: @min-[400px]:p-2
// expect: hover:@sm:hidden
export const a = <div className="@max-md:flex @lg:grid @min-[400px]:p-2 hover:@sm:hidden" />
