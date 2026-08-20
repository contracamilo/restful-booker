package runners;

import io.cucumber.junit.Cucumber;
import io.cucumber.junit.CucumberOptions;
import org.junit.runner.RunWith;

// Runner de JUnit para las features de Cucumber. La ejecucion via
// mvn test produce reportes JUnit XML estandar en target/surefire-reports/,
// que sirven como evidencia de ejecucion (seccion 9 del MTP).
@RunWith(Cucumber.class)
@CucumberOptions(
        features = "src/test/resources/features",
        glue = "steps",
        plugin = {
                "pretty",
                "junit:target/cucumber-reports/cucumber.xml",
                "html:target/cucumber-reports/cucumber.html"
        }
)
public class RunCucumberTest {
}
