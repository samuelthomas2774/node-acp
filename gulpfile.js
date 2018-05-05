const gulp = require('gulp');
const pump = require('pump');
const babel = require('gulp-babel');
const plumber = require('gulp-plumber');

gulp.task('build', function () {
    return pump([
        gulp.src('src/**/*.js'),
        plumber(),
        babel(),
        gulp.dest('dist')
    ]);
});

gulp.task('build-tests', function () {
    return pump([
        gulp.src('tests/**/*.js'),
        plumber(),
        babel(),
        gulp.dest('tests-dist')
    ]);
});

gulp.task('watch', gulp.series('build', function () {
    return gulp.watch('src/**/*.js', gulp.series('build'));
}));

gulp.task('watch-tests', gulp.series('build-tests', function () {
    return gulp.watch('src/**/*.js', gulp.series('build-tests'));
}));

gulp.task('build-all', gulp.parallel('build', 'build-tests'));
gulp.task('watch-all', gulp.parallel('watch', 'watch-tests'));
